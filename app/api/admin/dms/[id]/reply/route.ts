import { after } from "next/server";
import { requireAdmin } from "../../../auth";
import { replyDmThread, updateAdminDmReply, type DmAttachment } from "../../../../dms/store";
import { notifyDmReply } from "../../../../push/notify";

export const runtime = "nodejs";

async function ensureAdmin(request: Request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "admin login is required" }, { status: 401 });
  }
  return null;
}

function parseAttachment(value: unknown): DmAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<DmAttachment>;
  const url = typeof a.url === "string" ? a.url : "";
  if (!/^\/api\/dms\/file\?p=dm%2F/.test(url)) return undefined;
  return { url, name: String(a.name || "첨부파일").slice(0, 120), type: String(a.type || "").slice(0, 80) };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = await ensureAdmin(request);
  if (adminError) return adminError;

  let payload: { message?: string; attachment?: unknown };
  try {
    payload = (await request.json()) as { message?: string; attachment?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = payload.message?.trim() || "";
  const attachment = parseAttachment(payload.attachment);
  if (!message && !attachment) {
    return Response.json({ error: "message or attachment is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const thread = await replyDmThread(id, message, attachment);
  if (!thread) {
    return Response.json({ error: "DM not found" }, { status: 404 });
  }

  after(() => notifyDmReply(thread));
  return Response.json({ thread });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = await ensureAdmin(request);
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
