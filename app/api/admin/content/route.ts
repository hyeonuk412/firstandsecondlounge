import { adminConfigured, requireAdmin } from "../auth";
import { getLoungeContent, updateLoungeContent } from "../../lounge-content/store";

export async function GET(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "DM_ADMIN_PASSWORD is not configured" }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(getLoungeContent(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "DM_ADMIN_PASSWORD is not configured" }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { notices?: unknown[]; schedules?: unknown[]; links?: unknown };
  try {
    payload = (await request.json()) as { notices?: unknown[]; schedules?: unknown[]; links?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return Response.json(updateLoungeContent(payload));
}
