import { readViewerSession } from "../../../../auth/chzzk/session";
import { getPost, updateComment, deleteComment } from "../../../store";
import { getLoungeContent, adminNicknameStrings } from "../../../../lounge-content/store";

export const runtime = "nodejs";

async function isAdminViewer(nickname: string, channelName: string) {
  const content = await getLoungeContent();
  const admins = new Set(adminNicknameStrings(content.settings));
  return admins.has(nickname) || admins.has(channelName);
}

// Edit a comment — author only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const { id, commentId } = await params;
  const post = await getPost(id);
  const comment = post?.comments.find((c) => c.id === commentId);
  if (!post || !comment) {
    return Response.json({ error: "댓글을 찾을 수 없어요" }, { status: 404 });
  }
  if (comment.author.channelId !== viewer.channelId) {
    return Response.json({ error: "본인 댓글만 수정할 수 있어요" }, { status: 403 });
  }

  let payload: { body?: string };
  try {
    payload = (await request.json()) as { body?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = String(payload.body || "").trim();
  if (!body && !comment.attachment) {
    return Response.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  const updated = await updateComment(id, commentId, body);
  return Response.json({ post: updated });
}

// Delete a comment — author or admin.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const { id, commentId } = await params;
  const post = await getPost(id);
  const comment = post?.comments.find((c) => c.id === commentId);
  if (!post || !comment) {
    return Response.json({ error: "댓글을 찾을 수 없어요" }, { status: 404 });
  }

  const owner = comment.author.channelId === viewer.channelId;
  if (!owner && !(await isAdminViewer(viewer.nickname, viewer.channelName))) {
    return Response.json({ error: "삭제 권한이 없어요" }, { status: 403 });
  }

  const ok = await deleteComment(id, commentId);
  if (!ok) {
    return Response.json({ error: "댓글을 찾을 수 없어요" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
