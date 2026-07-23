import { after } from "next/server";
import { readViewerSession } from "../../../auth/chzzk/session";
import { addComment, type BoardAttachment } from "../../store";
import { notifyNewComment } from "../../../push/notify";

export const runtime = "nodejs";

function parseAttachment(value: unknown): BoardAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<BoardAttachment>;
  const url = typeof a.url === "string" ? a.url : "";
  if (!/^\/api\/board\/file\?p=board%2F/.test(url)) return undefined;
  return { url, name: String(a.name || "이미지").slice(0, 120), type: String(a.type || "").slice(0, 80) };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  const { id } = await params;

  let payload: { body?: string; attachment?: unknown };
  try {
    payload = (await request.json()) as { body?: string; attachment?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = (payload.body || "").trim();
  const attachment = parseAttachment(payload.attachment);
  if (!body && !attachment) {
    return Response.json({ error: "댓글 내용 또는 이미지가 필요해요" }, { status: 400 });
  }
  if (body.length > 1000) {
    return Response.json({ error: "댓글이 너무 길어요" }, { status: 400 });
  }

  const post = await addComment(id, {
    author: { channelId: viewer.channelId, channelName: viewer.channelName, nickname: viewer.nickname },
    body,
    attachment,
  });
  if (!post) {
    return Response.json({ error: "게시글을 찾을 수 없어요" }, { status: 404 });
  }
  const newComment = post.comments[post.comments.length - 1];
  if (newComment) after(() => notifyNewComment(post, newComment));
  return Response.json({ post });
}
