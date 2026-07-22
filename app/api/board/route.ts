import { readViewerSession } from "../auth/chzzk/session";
import { listPosts, createPost, type BoardAttachment } from "./store";

export const runtime = "nodejs";

function parseAttachment(value: unknown): BoardAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<BoardAttachment>;
  const url = typeof a.url === "string" ? a.url : "";
  // only accept the board image proxy path we produced
  if (!/^\/api\/board\/file\?p=board%2F/.test(url)) return undefined;
  return { url, name: String(a.name || "이미지").slice(0, 120), type: String(a.type || "").slice(0, 80) };
}

export async function GET() {
  return Response.json({ posts: await listPosts() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  let payload: { body?: string; attachment?: unknown };
  try {
    payload = (await request.json()) as { body?: string; attachment?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = (payload.body || "").trim();
  const attachment = parseAttachment(payload.attachment);
  if (!body && !attachment) {
    return Response.json({ error: "내용 또는 이미지가 필요해요" }, { status: 400 });
  }
  if (body.length > 2000) {
    return Response.json({ error: "내용이 너무 길어요" }, { status: 400 });
  }

  const post = await createPost({
    author: { channelId: viewer.channelId, channelName: viewer.channelName, nickname: viewer.nickname },
    body,
    attachment,
  });
  return Response.json({ post }, { status: 201 });
}
