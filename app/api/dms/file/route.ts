import { get } from "@vercel/blob";
import { readViewerSession } from "../../auth/chzzk/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return new Response("CHZZK login is required", { status: 401 });
  }

  const pathname = new URL(request.url).searchParams.get("p") || "";
  // only serve our DM attachment keys
  if (!pathname || !pathname.startsWith("dm/")) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const result = await get(pathname, { access: "private" });
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Failed to load attachment", { status: 500 });
  }
}
