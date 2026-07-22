import { readViewerSession } from "../auth/chzzk/session";
import { appendViewerDmThread, createDmThread, type DmAttachment, type DmTarget } from "./store";
import { notifyNewDm } from "../push/notify";

export const runtime = "nodejs";

const ALLOWED_CATEGORIES = new Set(["support", "question", "suggestion", "business", "etc"]);
const ALLOWED_TARGETS = new Set<DmTarget>(["first", "second", "both"]);

function parseAttachment(value: unknown): DmAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<DmAttachment>;
  const url = typeof a.url === "string" ? a.url : "";
  // only accept the attachment proxy path we produced
  if (!/^\/api\/dms\/file\?p=dm%2F/.test(url)) return undefined;
  return { url, name: String(a.name || "첨부파일").slice(0, 120), type: String(a.type || "").slice(0, 80) };
}

export async function POST(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  let payload: { category?: string; target?: string; message?: string; threadId?: string; attachment?: unknown };
  try {
    payload = (await request.json()) as { category?: string; target?: string; message?: string; threadId?: string; attachment?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = ALLOWED_CATEGORIES.has(payload.category || "") ? payload.category! : "etc";
  const target: DmTarget = ALLOWED_TARGETS.has(payload.target as DmTarget) ? (payload.target as DmTarget) : "both";
  const message = payload.message?.trim() || "";
  const attachment = parseAttachment(payload.attachment);
  if (!message && !attachment) {
    return Response.json({ error: "message or attachment is required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: "message is too long" }, { status: 400 });
  }

  if (payload.threadId) {
    const thread = await appendViewerDmThread({
      threadId: payload.threadId,
      channelId: viewer.channelId,
      message,
      attachment,
    });

    if (!thread) {
      return Response.json({ error: "DM not found" }, { status: 404 });
    }

    await notifyNewDm(thread);
    return Response.json({ thread });
  }

  const thread = await createDmThread({
    viewer: {
      channelId: viewer.channelId,
      channelName: viewer.channelName,
      nickname: viewer.nickname,
    },
    category,
    target,
    message,
    attachment,
  });

  await notifyNewDm(thread);
  return Response.json({ thread }, { status: 201 });
}

