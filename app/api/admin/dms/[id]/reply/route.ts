import { adminConfigured, requireAdmin } from "../../../auth";
import { replyDmThread } from "../../../../dms/store";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!adminConfigured()) {
    return Response.json({ error: "DM_ADMIN_PASSWORD is not configured" }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return Response.json({ error: "admin token is required" }, { status: 401 });
  }

  let payload: { message?: string };
  try {
    payload = (await request.json()) as { message?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = payload.message?.trim() || "";
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const thread = replyDmThread(id, message);
  if (!thread) {
    return Response.json({ error: "DM not found" }, { status: 404 });
  }

  return Response.json({ thread });
}
