import { getAdminContext } from "../auth";
import { listDmThreads, adminSeesTarget } from "../../dms/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getAdminContext(request);
  if (!context) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }

  const all = await listDmThreads();
  const threads = all.filter((thread) => adminSeesTarget(context.role, thread.target));

  return Response.json({ threads, role: context.role });
}
