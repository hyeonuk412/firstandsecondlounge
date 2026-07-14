export type DmMessage = {
  id: string;
  sender: "viewer" | "admin";
  message: string;
  createdAt: string;
};

export type DmThread = {
  id: string;
  viewer: {
    channelId: string;
    channelName: string;
    nickname: string;
  };
  category: string;
  status: "waiting" | "answered";
  createdAt: string;
  updatedAt: string;
  messages: DmMessage[];
};

declare global {
  var __firstAndSecondDmThreads: DmThread[] | undefined;
}

function store() {
  globalThis.__firstAndSecondDmThreads ??= [];
  return globalThis.__firstAndSecondDmThreads;
}

function now() {
  return new Date().toISOString();
}

export function listDmThreads() {
  return store().slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listViewerDmThreads(channelId: string) {
  return listDmThreads().filter((thread) => thread.viewer.channelId === channelId);
}

export function createDmThread(input: {
  viewer: DmThread["viewer"];
  category: string;
  message: string;
}) {
  const createdAt = now();
  const thread: DmThread = {
    id: crypto.randomUUID(),
    viewer: input.viewer,
    category: input.category,
    status: "waiting",
    createdAt,
    updatedAt: createdAt,
    messages: [
      {
        id: crypto.randomUUID(),
        sender: "viewer",
        message: input.message,
        createdAt,
      },
    ],
  };
  store().unshift(thread);
  return thread;
}

export function appendViewerDmThread(input: {
  threadId: string;
  channelId: string;
  message: string;
}) {
  const thread = store().find((item) => item.id === input.threadId && item.viewer.channelId === input.channelId);
  if (!thread) return null;

  const createdAt = now();
  thread.messages.push({
    id: crypto.randomUUID(),
    sender: "viewer",
    message: input.message,
    createdAt,
  });
  thread.status = "waiting";
  thread.updatedAt = createdAt;
  return thread;
}

export function updateAdminDmReply(threadId: string, messageId: string, message: string) {
  const thread = store().find((item) => item.id === threadId);
  if (!thread) return null;

  const existing = thread.messages.find((item) => item.id === messageId && item.sender === "admin");
  if (!existing) return null;

  existing.message = message;
  return thread;
}

export function replyDmThread(threadId: string, message: string) {
  const thread = store().find((item) => item.id === threadId);
  if (!thread) return null;

  const createdAt = now();
  thread.messages.push({
    id: crypto.randomUUID(),
    sender: "admin",
    message,
    createdAt,
  });
  thread.status = "answered";
  thread.updatedAt = createdAt;
  return thread;
}
