import { requireAdmin } from "../auth";
import { listDmThreads } from "../../dms/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }

  return Response.json({ threads: await listDmThreads() });
}
