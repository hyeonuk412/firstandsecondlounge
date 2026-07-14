import { getLoungeContent } from "./store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getLoungeContent(), {
    headers: { "Cache-Control": "no-store" },
  });
}
