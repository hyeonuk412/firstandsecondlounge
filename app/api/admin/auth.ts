import { readViewerSession } from "../auth/chzzk/session";
import { getLoungeContent, adminNicknameStrings, roleForNickname, type AdminRole } from "../lounge-content/store";

export async function getAdminContext(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) return null;

  const content = await getLoungeContent();
  const admins = new Set(adminNicknameStrings(content.settings));
  if (!admins.has(viewer.nickname) && !admins.has(viewer.channelName)) return null;

  const role: AdminRole = roleForNickname(content.settings, viewer.nickname, viewer.channelName) || "operator";
  return { viewer, role };
}

export async function getAdminViewer(request: Request) {
  const context = await getAdminContext(request);
  return context ? context.viewer : null;
}

export async function requireAdmin(request: Request) {
  return Boolean(await getAdminContext(request));
}
