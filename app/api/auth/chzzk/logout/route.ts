import { clearViewerCookie } from "../session";

export async function GET(request: Request) {
  const headers = new Headers({ Location: "/#dm" });
  headers.append("Set-Cookie", clearViewerCookie(request.url));
  return new Response(null, { status: 302, headers });
}
