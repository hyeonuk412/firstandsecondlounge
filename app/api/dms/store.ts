import { del } from "@vercel/blob";
import { hasFirebaseConfig, firestore } from "../firebase";
import type { AdminRole } from "../lounge-content/store";

async function deleteAttachments(thread: DmThread | null) {
  if (!thread || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const pathnames = thread.messages
    .map((message) => {
      const url = message.attachment?.url || "";
      const match = url.match(/[?&]p=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    })
    .filter((pathname) => pathname.startsWith("dm/"));
  if (!pathnames.length) return;
  try {
    await del(pathnames);
  } catch {
    // best-effort cleanup; ignore blob deletion failures
  }
}

export type DmAttachment = {
  url: string;
  name: string;
  type: string;
};

export type DmMessage = {
  id: string;
  sender: "viewer" | "admin";
  message: string;
  createdAt: string;
  attachment?: DmAttachment;
};

function normalizeAttachment(value: unknown): DmAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<DmAttachment>;
  if (!a.url) return undefined;
  return { url: String(a.url), name: String(a.name || ""), type: String(a.type || "") };
}

function buildMessage(sender: "viewer" | "admin", message: string, createdAt: string, attachment?: DmAttachment): DmMessage {
  const base: DmMessage = { id: crypto.randomUUID(), sender, message, createdAt };
  return attachment ? { ...base, attachment } : base;
}

export type DmTarget = "first" | "second" | "both";

function normalizeTarget(value: unknown): DmTarget {
  return value === "first" || value === "second" ? value : "both";
}

// Whether an admin with the given role should see / be notified of a DM.
export function adminSeesTarget(role: AdminRole, target: DmTarget): boolean {
  if (role === "operator") return true;
  if (role === "first") return target === "first" || target === "both";
  if (role === "second") return target === "second" || target === "both";
  return false; // "none" (제외)
}

export type DmThread = {
  id: string;
  viewer: {
    channelId: string;
    channelName: string;
    nickname: string;
  };
  category: string;
  target: DmTarget;
  status: "waiting" | "answered";
  createdAt: string;
  updatedAt: string;
  messages: DmMessage[];
};

declare global {
  var __firstAndSecondDmThreads: DmThread[] | undefined;
}

function memoryStore() {
  globalThis.__firstAndSecondDmThreads ??= [];
  return globalThis.__firstAndSecondDmThreads;
}

function now() {
  return new Date().toISOString();
}

function dmsCollection() {
  return firestore().collection("dms");
}

function normalizeThread(data: FirebaseFirestore.DocumentData | undefined, fallbackId = ""): DmThread | null {
  if (!data) return null;
  const messages = Array.isArray(data.messages) ? data.messages : [];
  return {
    id: String(data.id || fallbackId),
    viewer: {
      channelId: String(data.viewer?.channelId || ""),
      channelName: String(data.viewer?.channelName || ""),
      nickname: String(data.viewer?.nickname || ""),
    },
    category: String(data.category || "etc"),
    target: normalizeTarget(data.target),
    status: data.status === "answered" ? "answered" : "waiting",
    createdAt: String(data.createdAt || now()),
    updatedAt: String(data.updatedAt || data.createdAt || now()),
    messages: messages.map((message: Partial<DmMessage>) => {
      const attachment = normalizeAttachment(message.attachment);
      const base: DmMessage = {
        id: String(message.id || crypto.randomUUID()),
        sender: message.sender === "admin" ? "admin" : "viewer",
        message: String(message.message || ""),
        createdAt: String(message.createdAt || now()),
      };
      return attachment ? { ...base, attachment } : base;
    }),
  };
}

function sortThreads(items: DmThread[]) {
  return items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listDmThreads() {
  if (!hasFirebaseConfig()) return sortThreads(memoryStore());

  const snapshot = await dmsCollection().orderBy("updatedAt", "desc").get();
  return snapshot.docs
    .map((doc) => normalizeThread(doc.data(), doc.id))
    .filter((thread): thread is DmThread => Boolean(thread));
}

export async function listViewerDmThreads(channelId: string) {
  if (!hasFirebaseConfig()) return sortThreads(memoryStore().filter((thread) => thread.viewer.channelId === channelId));

  const snapshot = await dmsCollection().where("viewer.channelId", "==", channelId).get();
  return sortThreads(snapshot.docs
    .map((doc) => normalizeThread(doc.data(), doc.id))
    .filter((thread): thread is DmThread => Boolean(thread)));
}

export async function createDmThread(input: {
  viewer: DmThread["viewer"];
  category: string;
  target: DmTarget;
  message: string;
  attachment?: DmAttachment;
}) {
  const createdAt = now();
  const thread: DmThread = {
    id: crypto.randomUUID(),
    viewer: input.viewer,
    category: input.category,
    target: input.target,
    status: "waiting",
    createdAt,
    updatedAt: createdAt,
    messages: [buildMessage("viewer", input.message, createdAt, input.attachment)],
  };

  if (!hasFirebaseConfig()) {
    memoryStore().unshift(thread);
    return thread;
  }

  await dmsCollection().doc(thread.id).set(thread);
  return thread;
}

export async function appendViewerDmThread(input: {
  threadId: string;
  channelId: string;
  message: string;
  attachment?: DmAttachment;
}) {
  if (!hasFirebaseConfig()) {
    const thread = memoryStore().find((item) => item.id === input.threadId && item.viewer.channelId === input.channelId);
    if (!thread) return null;
    const createdAt = now();
    thread.messages.push(buildMessage("viewer", input.message, createdAt, input.attachment));
    thread.status = "waiting";
    thread.updatedAt = createdAt;
    return thread;
  }

  const ref = dmsCollection().doc(input.threadId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const thread = normalizeThread(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !thread || thread.viewer.channelId !== input.channelId) return null;

    const createdAt = now();
    const next: DmThread = {
      ...thread,
      status: "waiting",
      updatedAt: createdAt,
      messages: [...thread.messages, buildMessage("viewer", input.message, createdAt, input.attachment)],
    };
    transaction.set(ref, next);
    return next;
  });
}

export async function updateAdminDmReply(threadId: string, messageId: string, message: string) {
  if (!hasFirebaseConfig()) {
    const thread = memoryStore().find((item) => item.id === threadId);
    if (!thread) return null;
    const existing = thread.messages.find((item) => item.id === messageId && item.sender === "admin");
    if (!existing) return null;
    existing.message = message;
    return thread;
  }

  const ref = dmsCollection().doc(threadId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const thread = normalizeThread(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !thread) return null;
    const messages = thread.messages.map((item) => item.id === messageId && item.sender === "admin" ? { ...item, message } : item);
    if (messages === thread.messages || !thread.messages.some((item) => item.id === messageId && item.sender === "admin")) return null;
    const next = { ...thread, messages };
    transaction.set(ref, next);
    return next;
  });
}

export async function replyDmThread(threadId: string, message: string, attachment?: DmAttachment) {
  if (!hasFirebaseConfig()) {
    const thread = memoryStore().find((item) => item.id === threadId);
    if (!thread) return null;
    const createdAt = now();
    thread.messages.push(buildMessage("admin", message, createdAt, attachment));
    thread.status = "answered";
    thread.updatedAt = createdAt;
    return thread;
  }

  const ref = dmsCollection().doc(threadId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const thread = normalizeThread(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !thread) return null;

    const createdAt = now();
    const next: DmThread = {
      ...thread,
      status: "answered",
      updatedAt: createdAt,
      messages: [...thread.messages, buildMessage("admin", message, createdAt, attachment)],
    };
    transaction.set(ref, next);
    return next;
  });
}

export async function deleteDmThread(threadId: string) {
  if (!hasFirebaseConfig()) {
    const store = memoryStore();
    const index = store.findIndex((item) => item.id === threadId);
    if (index === -1) return false;
    await deleteAttachments(store[index]);
    store.splice(index, 1);
    return true;
  }

  const ref = dmsCollection().doc(threadId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await deleteAttachments(normalizeThread(snapshot.data(), snapshot.id));
  await ref.delete();
  return true;
}

export async function deleteViewerDmThread(threadId: string, channelId: string) {
  if (!hasFirebaseConfig()) {
    const store = memoryStore();
    const index = store.findIndex((item) => item.id === threadId && item.viewer.channelId === channelId);
    if (index === -1) return false;
    store.splice(index, 1);
    return true;
  }

  const ref = dmsCollection().doc(threadId);
  const snapshot = await ref.get();
  const thread = normalizeThread(snapshot.data(), snapshot.id);
  if (!snapshot.exists || !thread || thread.viewer.channelId !== channelId) return false;
  await ref.delete();
  return true;
}

