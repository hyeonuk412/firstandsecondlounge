import { readViewerSession } from "../session";

export async function GET(request: Request) {
  const viewer = await readViewerSession(request);
  return Response.json({ authenticated: Boolean(viewer), viewer });
}
