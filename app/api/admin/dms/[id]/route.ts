import { requireAdmin } from "../../auth";
import { deleteDmThread } from "../../../dms/store";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteDmThread(id);
  if (!deleted) {
    return Response.json({ error: "DM not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
