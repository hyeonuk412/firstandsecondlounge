import { requireAdmin } from "../../auth";
import { deletePost } from "../../../board/store";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deletePost(id);
  if (!ok) {
    return Response.json({ error: "게시글을 찾을 수 없어요" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
