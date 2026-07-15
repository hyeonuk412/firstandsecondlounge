import { hasFirebaseConfig, firestore } from "../firebase";

export type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date: string;
};

export type ScheduleItem = {
  id: string;
  date?: string;
  day: string;
  time: string;
  title: string;
};

export type SiteSettings = {
  discordUrl: string;
  discordNoticeChannelId: string;
  adminNicknames: string[];
};

export type LinkSettings = {
  discordUrl: string;
};

export type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
  settings: SiteSettings;
  links: LinkSettings;
  updatedAt: string;
};

const DEFAULT_NOTICES: NoticeItem[] = [];

const DEFAULT_SETTINGS: SiteSettings = {
  discordUrl: "",
  discordNoticeChannelId: "",
  adminNicknames: ["첫째와둘째", "첫째입니다", "오늘의메뉴"],
};

const DEFAULT_SCHEDULES: ScheduleItem[] = [];

declare global {
  var __firstAndSecondLoungeContent: LoungeContent | undefined;
  var __firstAndSecondLoungeContentCache: { expiresAt: number; content: LoungeContent } | undefined;
}

function now() {
  return new Date().toISOString();
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanAdminNicknames(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.adminNicknames;
  const nicknames = value
    .map((item) => cleanText(item, 40))
    .filter(Boolean)
    .slice(0, 20);
  return nicknames.length ? Array.from(new Set(nicknames)) : DEFAULT_SETTINGS.adminNicknames;
}

function cleanSettings(value: unknown): SiteSettings {
  const settings = value as Partial<SiteSettings> | undefined;
  return {
    discordUrl: cleanText(settings?.discordUrl, 300),
    discordNoticeChannelId: cleanText(settings?.discordNoticeChannelId, 40),
    adminNicknames: cleanAdminNicknames(settings?.adminNicknames),
  };
}

function cleanLinks(value: unknown): LinkSettings {
  const links = value as Partial<LinkSettings> | undefined;
  return {
    discordUrl: cleanText(links?.discordUrl, 300),
  };
}

function normalizeSettings(content?: Partial<LoungeContent>) {
  const legacyLinks = cleanLinks(content?.links);
  const settings = cleanSettings(content?.settings);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    discordUrl: settings.discordUrl || legacyLinks.discordUrl || DEFAULT_SETTINGS.discordUrl,
    adminNicknames: settings.adminNicknames?.length ? settings.adminNicknames : DEFAULT_SETTINGS.adminNicknames,
  };
}

function withDefaults(content?: Partial<LoungeContent>): LoungeContent {
  const settings = normalizeSettings(content);
  return {
    notices: Array.isArray(content?.notices) ? content.notices : DEFAULT_NOTICES,
    schedules: Array.isArray(content?.schedules) ? content.schedules : DEFAULT_SCHEDULES,
    settings,
    links: { discordUrl: settings.discordUrl },
    updatedAt: content?.updatedAt || now(),
  };
}

function memoryStore() {
  globalThis.__firstAndSecondLoungeContent ??= withDefaults();
  return globalThis.__firstAndSecondLoungeContent;
}

function cleanNotice(item: unknown, index: number): NoticeItem | null {
  const value = item as Partial<NoticeItem>;
  const tag = cleanText(value.tag, 12) || "공지";
  const title = cleanText(value.title, 80);
  const body = cleanText(value.body, 2000);
  const date = cleanText(value.date, 20) || now().slice(0, 10);
  if (!title && !body) return null;
  return {
    id: cleanText(value.id, 80) || crypto.randomUUID() || "notice-" + Date.now() + "-" + index,
    tag,
    title: title || "제목 없음",
    body,
    date,
  };
}

function cleanSchedule(item: unknown, index: number): ScheduleItem | null {
  const value = item as Partial<ScheduleItem>;
  const date = cleanText(value.date, 20);
  const day = cleanText(value.day, 8);
  const time = cleanText(value.time, 20);
  const title = cleanText(value.title, 80);
  if (!date && !day && !time && !title) return null;
  return {
    id: cleanText(value.id, 80) || crypto.randomUUID() || "schedule-" + Date.now() + "-" + index,
    date,
    day: day || "-",
    time: time || "미정",
    title: title || "일정 미정",
  };
}

function contentDoc() {
  return firestore().collection("loungeContent").doc("main");
}

function readCachedContent() {
  const cached = globalThis.__firstAndSecondLoungeContentCache;
  if (cached && cached.expiresAt > Date.now()) return cached.content;
  return null;
}

function writeCachedContent(content: LoungeContent) {
  globalThis.__firstAndSecondLoungeContentCache = { expiresAt: Date.now() + 10000, content };
}

export async function getLoungeContent() {
  if (!hasFirebaseConfig()) return withDefaults(memoryStore());

  const cached = readCachedContent();
  if (cached) return cached;

  const snapshot = await contentDoc().get();
  if (!snapshot.exists) {
    const initial = withDefaults();
    await contentDoc().set(initial);
    writeCachedContent(initial);
    return initial;
  }
  const content = withDefaults(snapshot.data() as Partial<LoungeContent>);
  writeCachedContent(content);
  return content;
}

export async function updateLoungeContent(input: { notices?: unknown[]; schedules?: unknown[]; links?: unknown; settings?: unknown }) {
  const previous = await getLoungeContent();
  const notices = Array.isArray(input.notices) ? input.notices.map(cleanNotice).filter((item): item is NoticeItem => Boolean(item)).slice(0, 100) : previous.notices;
  const schedules = Array.isArray(input.schedules) ? input.schedules.map(cleanSchedule).filter((item): item is ScheduleItem => Boolean(item)).slice(0, 200) : previous.schedules;
  const settings = cleanSettings(input.settings || { ...previous.settings, ...cleanLinks(input.links) });

  const next = withDefaults({
    notices,
    schedules,
    settings,
    updatedAt: now(),
  });

  if (!hasFirebaseConfig()) {
    globalThis.__firstAndSecondLoungeContent = next;
    return next;
  }

  await contentDoc().set(next);
  writeCachedContent(next);
  return next;
}
