import { getLoungeContent, type NoticeItem } from "./store";
import { getDiscordNoticesCached } from "../discord/notices";

// Notices shown on public pages: stored notices (manual + admin-imported)
// merged with live Discord posts. Stored items win on id collision so admin
// edits to an imported post are preserved.
export async function getDisplayNotices(): Promise<NoticeItem[]> {
  const content = await getLoungeContent();
  const stored = Array.isArray(content.notices) ? content.notices : [];
  const channelId = content.settings?.discordNoticeChannelId || "";
  if (!channelId) return stored;

  const live = await getDiscordNoticesCached(channelId);
  if (!live.length) return stored;

  const seen = new Set(stored.map((notice) => notice.id));
  return [...stored, ...live.filter((notice) => !seen.has(notice.id))];
}
