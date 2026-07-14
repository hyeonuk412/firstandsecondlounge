import { readViewerSession } from "../auth/chzzk/session";
import { createDmThread } from "./store";

const ALLOWED_CATEGORIES = new Set(["support", "question", "suggestion", "business", "etc"]);

export async function POST(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  let payload: { category?: string; message?: string };
  try {
    payload = (await request.json()) as { category?: string; message?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = ALLOWED_CATEGORIES.has(payload.category || "") ? payload.category! : "etc";
  const message = payload.message?.trim() || "";
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: "message is too long" }, { status: 400 });
  }

  const thread = createDmThread({
    viewer: {
      channelId: viewer.channelId,
      channelName: viewer.channelName,
      nickname: viewer.nickname,
    },
    category,
    message,
  });

  return Response.json({ thread }, { status: 201 });
}
