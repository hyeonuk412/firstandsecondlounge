import { get } from "@vercel/blob";

export const runtime = "nodejs";

// Board images are public content, so this proxy does not require login.
// It only serves board/ keys and streams the private blob via the server token.
export async function GET(request: Request) {
  const pathname = new URL(request.url).searchParams.get("p") || "";
  if (!pathname || !pathname.startsWith("board/")) {
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
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Failed to load image", { status: 500 });
  }
}
