import { del } from "@vercel/blob";
import { hasFirebaseConfig, firestore } from "../firebase";

export type BoardAttachment = { url: string; name: string; type: string };
export type BoardAuthor = { channelId: string; channelName: string; nickname: string };

export type BoardComment = {
  id: string;
  author: BoardAuthor;
  body: string;
  attachment?: BoardAttachment;
  createdAt: string;
};

export type BoardPost = {
  id: string;
  author: BoardAuthor;
  body: string;
  attachment?: BoardAttachment;
  createdAt: string;
  updatedAt: string;
  comments: BoardComment[];
};

declare global {
  var __firstAndSecondBoardPosts: BoardPost[] | undefined;
  var __firstAndSecondBoardCache: { expiresAt: number; posts: BoardPost[] } | undefined;
}

function memoryStore() {
  globalThis.__firstAndSecondBoardPosts ??= [];
  return globalThis.__firstAndSecondBoardPosts;
}

function bustPostsCache() {
  globalThis.__firstAndSecondBoardCache = undefined;
}

function now() {
  return new Date().toISOString();
}

function postsCollection() {
  return firestore().collection("boardPosts");
}

function normalizeAttachment(value: unknown): BoardAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Partial<BoardAttachment>;
  if (!a.url) return undefined;
  return { url: String(a.url), name: String(a.name || ""), type: String(a.type || "") };
}

function normalizeAuthor(value: unknown): BoardAuthor {
  const a = (value || {}) as Partial<BoardAuthor>;
  return {
    channelId: String(a.channelId || ""),
    channelName: String(a.channelName || ""),
    nickname: String(a.nickname || ""),
  };
}

function normalizeComment(value: Partial<BoardComment>): BoardComment {
  const attachment = normalizeAttachment(value.attachment);
  const base: BoardComment = {
    id: String(value.id || crypto.randomUUID()),
    author: normalizeAuthor(value.author),
    body: String(value.body || ""),
    createdAt: String(value.createdAt || now()),
  };
  return attachment ? { ...base, attachment } : base;
}

function normalizePost(data: FirebaseFirestore.DocumentData | undefined, fallbackId = ""): BoardPost | null {
  if (!data) return null;
  const attachment = normalizeAttachment(data.attachment);
  const comments = Array.isArray(data.comments) ? data.comments.map(normalizeComment) : [];
  const base: BoardPost = {
    id: String(data.id || fallbackId),
    author: normalizeAuthor(data.author),
    body: String(data.body || ""),
    createdAt: String(data.createdAt || now()),
    updatedAt: String(data.updatedAt || data.createdAt || now()),
    comments,
  };
  return attachment ? { ...base, attachment } : base;
}

function sortByNewest(items: BoardPost[]) {
  return items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Best-effort cleanup of private blobs referenced by our proxy URLs.
async function deleteAttachments(urls: (string | undefined)[]) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const pathnames = urls
    .map((url) => {
      const match = (url || "").match(/[?&]p=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    })
    .filter((pathname) => pathname.startsWith("board/"));
  if (!pathnames.length) return;
  try {
    await del(pathnames);
  } catch {
    // ignore cleanup failures
  }
}

export async function listPosts(): Promise<BoardPost[]> {
  if (!hasFirebaseConfig()) return sortByNewest(memoryStore());
  const cached = globalThis.__firstAndSecondBoardCache;
  if (cached && cached.expiresAt > Date.now()) return cached.posts;
  const snapshot = await postsCollection().orderBy("createdAt", "desc").get();
  const posts = snapshot.docs
    .map((doc) => normalizePost(doc.data(), doc.id))
    .filter((post): post is BoardPost => Boolean(post));
  globalThis.__firstAndSecondBoardCache = { expiresAt: Date.now() + 8000, posts };
  return posts;
}

export async function getPost(id: string): Promise<BoardPost | null> {
  if (!hasFirebaseConfig()) return memoryStore().find((post) => post.id === id) || null;
  const snapshot = await postsCollection().doc(id).get();
  return snapshot.exists ? normalizePost(snapshot.data(), snapshot.id) : null;
}

export async function createPost(input: { author: BoardAuthor; body: string; attachment?: BoardAttachment }): Promise<BoardPost> {
  const createdAt = now();
  const post: BoardPost = {
    id: crypto.randomUUID(),
    author: input.author,
    body: input.body,
    createdAt,
    updatedAt: createdAt,
    comments: [],
    ...(input.attachment ? { attachment: input.attachment } : {}),
  };

  if (!hasFirebaseConfig()) {
    memoryStore().unshift(post);
    return post;
  }
  await postsCollection().doc(post.id).set(post);
  bustPostsCache();
  return post;
}

export async function addComment(postId: string, input: { author: BoardAuthor; body: string; attachment?: BoardAttachment }): Promise<BoardPost | null> {
  bustPostsCache();
  const createdAt = now();
  const comment: BoardComment = {
    id: crypto.randomUUID(),
    author: input.author,
    body: input.body,
    createdAt,
    ...(input.attachment ? { attachment: input.attachment } : {}),
  };

  if (!hasFirebaseConfig()) {
    const post = memoryStore().find((item) => item.id === postId);
    if (!post) return null;
    post.comments.push(comment);
    post.updatedAt = createdAt;
    return post;
  }

  const ref = postsCollection().doc(postId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const post = normalizePost(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !post) return null;
    const next: BoardPost = { ...post, updatedAt: createdAt, comments: [...post.comments, comment] };
    transaction.set(ref, next);
    return next;
  });
}

export async function updatePost(postId: string, body: string): Promise<BoardPost | null> {
  bustPostsCache();
  const updatedAt = now();
  if (!hasFirebaseConfig()) {
    const post = memoryStore().find((item) => item.id === postId);
    if (!post) return null;
    post.body = body;
    post.updatedAt = updatedAt;
    return post;
  }

  const ref = postsCollection().doc(postId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const post = normalizePost(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !post) return null;
    const next: BoardPost = { ...post, body, updatedAt };
    transaction.set(ref, next);
    return next;
  });
}

export async function updateComment(postId: string, commentId: string, body: string): Promise<BoardPost | null> {
  bustPostsCache();
  if (!hasFirebaseConfig()) {
    const post = memoryStore().find((item) => item.id === postId);
    if (!post) return null;
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) return null;
    comment.body = body;
    return post;
  }

  const ref = postsCollection().doc(postId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const post = normalizePost(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !post) return null;
    const comments = post.comments.map((c) => (c.id === commentId ? { ...c, body } : c));
    const next: BoardPost = { ...post, comments };
    transaction.set(ref, next);
    return next;
  });
}

export async function deletePost(postId: string): Promise<boolean> {
  bustPostsCache();
  if (!hasFirebaseConfig()) {
    const store = memoryStore();
    const index = store.findIndex((post) => post.id === postId);
    if (index === -1) return false;
    const [post] = store.splice(index, 1);
    await deleteAttachments([post.attachment?.url, ...post.comments.map((c) => c.attachment?.url)]);
    return true;
  }

  const ref = postsCollection().doc(postId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  const post = normalizePost(snapshot.data(), snapshot.id);
  await ref.delete();
  if (post) await deleteAttachments([post.attachment?.url, ...post.comments.map((c) => c.attachment?.url)]);
  return true;
}

export async function deleteComment(postId: string, commentId: string): Promise<boolean> {
  bustPostsCache();
  if (!hasFirebaseConfig()) {
    const post = memoryStore().find((item) => item.id === postId);
    if (!post) return false;
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) return false;
    post.comments = post.comments.filter((c) => c.id !== commentId);
    await deleteAttachments([comment.attachment?.url]);
    return true;
  }

  const ref = postsCollection().doc(postId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const post = normalizePost(snapshot.data(), snapshot.id);
    if (!snapshot.exists || !post) return false;
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) return false;
    transaction.set(ref, { ...post, comments: post.comments.filter((c) => c.id !== commentId) });
    await deleteAttachments([comment.attachment?.url]);
    return true;
  });
}
