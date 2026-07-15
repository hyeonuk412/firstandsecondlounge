import { requireAdmin } from "../../auth";
import { getLoungeContent } from "../../../lounge-content/store";
import { fetchDiscordNotices } from "../../../discord/notices";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { channelId?: string; limit?: number } = {};
  try {
    body = (await request.json()) as { channelId?: string; limit?: number };
  } catch {
    // empty body is fine; fall back to the saved channel id
  }

  const content = await getLoungeContent();
  const channelId = String(body.channelId || content.settings?.discordNoticeChannelId || "").trim();

  const result = await fetchDiscordNotices(channelId, body.limit || 30);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Messages exist but none produced readable text -> almost always the
  // Message Content privileged intent is still off for the bot.
  const note =
    result.notices.length === 0 && result.fetched > 0
      ? "디스코드에서 메시지는 확인했지만 내용을 읽지 못했어요. 개발자 포털 → Bot → 'MESSAGE CONTENT INTENT'를 켜고 저장한 뒤 다시 시도해주세요."
      : "";

  return Response.json({ notices: result.notices, fetched: result.fetched, note });
}
