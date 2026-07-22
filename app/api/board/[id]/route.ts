import { readViewerSession } from "../../auth/chzzk/session";
import { getPost, updatePost, deletePost } from "../store";
import { getLoungeContent, adminNicknameStrings } from "../../lounge-content/store";

export const runtime = "nodejs";

async function isAdminViewer(nickname: string, channelName: string) {
  const content = await getLoungeContent();
  const admins = new Set(adminNicknameStrings(content.settings));
  return admins.has(nickname) || admins.has(channelName);
}

// Edit a post — author only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return Response.json({ error: "게시글을 찾을 수 없어요" }, { status: 404 });
  }
  if (post.author.channelId !== viewer.channelId) {
    return Response.json({ error: "본인 글만 수정할 수 있어요" }, { status: 403 });
  }

  let payload: { body?: string };
  try {
    payload = (await request.json()) as { body?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = String(payload.body || "").trim();
  if (!body && !post.attachment) {
    return Response.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  const updated = await updatePost(id, body);
  return Response.json({ post: updated });
}

// Delete a post — author or admin.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return Response.json({ error: "게시글을 찾을 수 없어요" }, { status: 404 });
  }

  const owner = post.author.channelId === viewer.channelId;
  if (!owner && !(await isAdminViewer(viewer.nickname, viewer.channelName))) {
    return Response.json({ error: "삭제 권한이 없어요" }, { status: 403 });
  }

  await deletePost(id);
  return Response.json({ ok: true });
}
