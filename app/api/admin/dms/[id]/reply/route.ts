import { adminConfigured, requireAdmin } from "../../../auth";
import { replyDmThread, updateAdminDmReply } from "../../../../dms/store";

export const runtime = "nodejs";

function ensureAdmin(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "DM_ADMIN_PASSWORD is not configured" }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return Response.json({ error: "admin token is required" }, { status: 401 });
  }
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = ensureAdmin(request);
  if (adminError) return adminError;

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
  const thread = await replyDmThread(id, message);
  if (!thread) {
    return Response.json({ error: "DM not found" }, { status: 404 });
  }

  return Response.json({ thread });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = ensureAdmin(request);
  if (adminError) return adminError;

  let payload: { messageId?: string; message?: string };
  try {
    payload = (await request.json()) as { messageId?: string; message?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = payload.messageId?.trim() || "";
  const message = payload.message?.trim() || "";
  if (!messageId) {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const thread = await updateAdminDmReply(id, messageId, message);
  if (!thread) {
    return Response.json({ error: "DM reply not found" }, { status: 404 });
  }

  return Response.json({ thread });
}

