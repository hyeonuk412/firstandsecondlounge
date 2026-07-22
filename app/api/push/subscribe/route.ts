import { readViewerSession } from "../../auth/chzzk/session";
import { saveSubscription, removeSubscription } from "../store";

export const runtime = "nodejs";

type IncomingSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  let payload: { subscription?: IncomingSub };
  try {
    payload = (await request.json()) as { subscription?: IncomingSub };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sub = payload.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "invalid subscription" }, { status: 400 });
  }

  await saveSubscription({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    channelId: viewer.channelId,
    channelName: viewer.channelName,
    nickname: viewer.nickname,
    createdAt: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  let payload: { endpoint?: string };
  try {
    payload = (await request.json()) as { endpoint?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (payload.endpoint) await removeSubscription(payload.endpoint);
  return Response.json({ ok: true });
}
