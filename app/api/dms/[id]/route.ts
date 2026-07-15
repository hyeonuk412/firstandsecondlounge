import { readViewerSession } from "../../auth/chzzk/session";
import { deleteViewerDmThread } from "../store";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteViewerDmThread(id, viewer.channelId);
  if (!deleted) {
    return Response.json({ error: "DM not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
