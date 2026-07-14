import { readViewerSession } from "../auth/chzzk/session";
import { getLoungeContent } from "../lounge-content/store";

const DEFAULT_ADMIN_NICKNAMES = ["첫째와둘째", "첫째입니다", "오늘의메뉴"];

export async function getAdminViewer(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) return null;

  const content = await getLoungeContent();
  const nicknames = content.settings?.adminNicknames?.length ? content.settings.adminNicknames : DEFAULT_ADMIN_NICKNAMES;
  const admins = new Set(nicknames);
  if (!admins.has(viewer.nickname) && !admins.has(viewer.channelName)) return null;
  return viewer;
}

export async function requireAdmin(request: Request) {
  return Boolean(await getAdminViewer(request));
}
