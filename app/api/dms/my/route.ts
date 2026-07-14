import { readViewerSession } from "../../auth/chzzk/session";
import { listViewerDmThreads } from "../store";

export async function GET(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  return Response.json({ threads: listViewerDmThreads(viewer.channelId) });
}
