import { requireAdmin } from "../../../../auth";
import { deleteComment } from "../../../../../board/store";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }
  const { id, commentId } = await params;
  const ok = await deleteComment(id, commentId);
  if (!ok) {
    return Response.json({ error: "댓글을 찾을 수 없어요" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
