import { getAdminContext } from "../auth";
import { listDmThreads } from "../../dms/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getAdminContext(request);
  if (!context) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }

  const all = await listDmThreads();
  // operators see everything; 첫째/둘째 see threads addressed to them (or both)
  const threads = context.role === "operator"
    ? all
    : all.filter((thread) => thread.target === context.role || thread.target === "both");

  return Response.json({ threads, role: context.role });
}
