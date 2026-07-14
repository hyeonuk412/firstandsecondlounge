import { adminConfigured, requireAdmin } from "../auth";

export const runtime = "nodejs";
import { listDmThreads } from "../../dms/store";

export async function GET(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "DM_ADMIN_PASSWORD is not configured" }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return Response.json({ error: "admin token is required" }, { status: 401 });
  }

  return Response.json({ threads: await listDmThreads() });
}

