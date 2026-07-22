import { createHash } from "node:crypto";
import { hasFirebaseConfig, firestore } from "../firebase";

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  channelId: string;
  channelName: string;
  nickname: string;
  createdAt: string;
};

declare global {
  var __firstAndSecondPushSubs: PushSub[] | undefined;
}

function memoryStore() {
  globalThis.__firstAndSecondPushSubs ??= [];
  return globalThis.__firstAndSecondPushSubs;
}

function docId(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function collection() {
  return firestore().collection("pushSubscriptions");
}

function normalize(data: FirebaseFirestore.DocumentData | undefined): PushSub | null {
  if (!data || !data.endpoint || !data.keys?.p256dh || !data.keys?.auth) return null;
  return {
    endpoint: String(data.endpoint),
    keys: { p256dh: String(data.keys.p256dh), auth: String(data.keys.auth) },
    channelId: String(data.channelId || ""),
    channelName: String(data.channelName || ""),
    nickname: String(data.nickname || ""),
    createdAt: String(data.createdAt || new Date().toISOString()),
  };
}

export async function saveSubscription(sub: PushSub) {
  if (!hasFirebaseConfig()) {
    const store = memoryStore();
    const index = store.findIndex((item) => item.endpoint === sub.endpoint);
    if (index === -1) store.push(sub);
    else store[index] = sub;
    return;
  }
  await collection().doc(docId(sub.endpoint)).set(sub);
}

export async function removeSubscription(endpoint: string) {
  if (!hasFirebaseConfig()) {
    const store = memoryStore();
    const index = store.findIndex((item) => item.endpoint === endpoint);
    if (index !== -1) store.splice(index, 1);
    return;
  }
  await collection().doc(docId(endpoint)).delete().catch(() => {});
}

export async function listSubscriptions(): Promise<PushSub[]> {
  if (!hasFirebaseConfig()) return memoryStore().slice();
  const snapshot = await collection().get();
  return snapshot.docs.map((doc) => normalize(doc.data())).filter((sub): sub is PushSub => Boolean(sub));
}
