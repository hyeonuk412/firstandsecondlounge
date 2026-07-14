import { getLoungeContent } from "./store";

export async function GET() {
  return Response.json(getLoungeContent(), {
    headers: { "Cache-Control": "no-store" },
  });
}
