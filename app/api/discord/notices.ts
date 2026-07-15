export type DiscordNotice = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date: string;
};

type DiscordMessage = {
  id: string;
  content?: string;
  timestamp: string;
  type: number;
  author?: { bot?: boolean; username?: string };
  attachments?: { filename?: string }[];
  embeds?: { title?: string; description?: string }[];
};

export type DiscordFetchResult =
  | { ok: true; notices: DiscordNotice[] }
  | { ok: false; error: string; status?: number };

function kstDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return year && month && day ? `${year}-${month}-${day}` : iso.slice(0, 10);
}

function toNotice(message: DiscordMessage): DiscordNotice | null {
  const content = (message.content || "").trim();
  const embedText = (message.embeds || [])
    .map((embed) => [embed.title, embed.description].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
  const attachmentNames = (message.attachments || [])
    .map((attachment) => attachment.filename)
    .filter(Boolean) as string[];

  let body = [content, embedText].filter(Boolean).join("\n\n");
  if (!body && attachmentNames.length) body = `첨부파일: ${attachmentNames.join(", ")}`;
  if (!body) return null;

  const firstLine = body.split("\n").find((line) => line.trim()) || body;

  return {
    id: `discord-${message.id}`,
    tag: "공지",
    title: firstLine.trim().slice(0, 80) || "제목 없음",
    body: body.slice(0, 2000),
    date: kstDate(message.timestamp),
  };
}

// Reads recent messages from a Discord channel via the bot REST API and maps
// them to notice items (date = the Discord post date, in KST).
export async function fetchDiscordNotices(channelId: string, limit = 30): Promise<DiscordFetchResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "DISCORD_BOT_TOKEN 환경변수가 없어요. Vercel에 봇 토큰을 추가해주세요." };
  }
  if (!channelId) {
    return { ok: false, error: "디스코드 공지 채널 ID를 먼저 설정해주세요." };
  }

  const capped = Math.min(Math.max(Math.trunc(limit) || 30, 1), 100);
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages?limit=${capped}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent": "FirstAndSecondLounge (https://fnslounge.vercel.app, 1.0)",
        },
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "디스코드에 연결하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { message?: string };
      detail = data?.message || "";
    } catch {
      // ignore body parse failure; fall back to status-based hint
    }
    const hint =
      response.status === 401
        ? "봇 토큰이 올바른지 확인해주세요."
        : response.status === 403
          ? "봇이 해당 채널을 볼 수 있는 권한(채널 보기 / 메시지 기록 보기)이 있는지 확인해주세요."
          : response.status === 404
            ? "채널 ID가 올바른지, 봇이 그 서버에 들어가 있는지 확인해주세요."
            : detail || "디스코드에서 메시지를 불러오지 못했어요.";
    return { ok: false, error: hint, status: response.status };
  }

  let messages: DiscordMessage[];
  try {
    messages = (await response.json()) as DiscordMessage[];
  } catch {
    return { ok: false, error: "디스코드 응답을 해석하지 못했어요." };
  }

  const notices = messages
    .filter((message) => message.type === 0 || message.type === 19) // default + reply
    .map(toNotice)
    .filter((notice): notice is DiscordNotice => Boolean(notice));

  return { ok: true, notices };
}
