import webpush from "web-push";
import { listSubscriptions, removeSubscription, type PushSub } from "./store";
import { getLoungeContent, roleForNickname, type AdminRole } from "../lounge-content/store";
import type { DmThread } from "../dms/store";
import type { BoardPost, BoardComment } from "../board/store";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@fnslounge.app";

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch {
    configured = false;
  }
}

type PushPayload = { title: string; body: string; url: string };

// Never throws: push is best-effort and must not break the triggering request.
async function sendPush(subs: PushSub[], payload: PushPayload) {
  if (!configured || !subs.length) return;
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await removeSubscription(sub.endpoint);
      }
    }),
  );
}

function dedupe(subs: PushSub[]) {
  const map = new Map<string, PushSub>();
  subs.forEach((sub) => map.set(sub.endpoint, sub));
  return [...map.values()];
}

async function adminSubscriptions(): Promise<{ sub: PushSub; role: AdminRole }[]> {
  const [subs, content] = await Promise.all([listSubscriptions(), getLoungeContent()]);
  return subs
    .map((sub) => {
      const role = roleForNickname(content.settings, sub.nickname, sub.channelName);
      return role ? { sub, role } : null;
    })
    .filter((item): item is { sub: PushSub; role: AdminRole } => Boolean(item));
}

// New viewer DM -> notify admins who can see this target.
export async function notifyNewDm(thread: DmThread) {
  const admins = await adminSubscriptions();
  const targets = admins
    .filter(({ role }) => role === "operator" || thread.target === "both" || thread.target === role)
    .map((item) => item.sub);
  await sendPush(dedupe(targets), {
    title: "새 DM이 왔어요",
    body: `${thread.viewer.nickname || thread.viewer.channelName}님의 새 쪽지`,
    url: "/cheotdooladmin",
  });
}

// Admin reply -> notify the viewer who owns the thread.
export async function notifyDmReply(thread: DmThread) {
  const subs = (await listSubscriptions()).filter((sub) => sub.channelId === thread.viewer.channelId);
  await sendPush(dedupe(subs), {
    title: "DM 답변이 도착했어요",
    body: "첫째와둘째가 답장했어요",
    url: "/dm",
  });
}

// New board post -> notify all admins.
export async function notifyNewPost(post: BoardPost) {
  const targets = (await adminSubscriptions()).map((item) => item.sub);
  await sendPush(dedupe(targets), {
    title: "자유게시판 새 글",
    body: `${post.author.nickname || "익명"}님의 새 글`,
    url: "/board",
  });
}

// New comment -> notify admins + the post author (unless they wrote the comment).
export async function notifyNewComment(post: BoardPost, comment: BoardComment) {
  const adminSubs = (await adminSubscriptions()).map((item) => item.sub);
  const authorSubs = post.author.channelId && post.author.channelId !== comment.author.channelId
    ? (await listSubscriptions()).filter((sub) => sub.channelId === post.author.channelId)
    : [];
  await sendPush(dedupe([...adminSubs, ...authorSubs]), {
    title: "새 댓글이 달렸어요",
    body: `${comment.author.nickname || "익명"}님의 댓글`,
    url: "/board",
  });
}
