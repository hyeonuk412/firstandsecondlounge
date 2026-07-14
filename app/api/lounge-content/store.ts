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
  day: string;
  time: string;
  title: string;
};

export type SiteSettings = {
  discordUrl: string;
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

const DEFAULT_NOTICES: NoticeItem[] = [
  { id: "notice-open", tag: "공지", title: "팬 라운지 오픈", body: "방송 링크와 DM 창구를 먼저 열어두었어요.", date: "2026-07-14" },
  { id: "notice-login", tag: "DM", title: "치지직 로그인 필요", body: "DM과 답변함은 치지직 계정 기준으로 연결됩니다.", date: "2026-07-14" },
  { id: "notice-schedule", tag: "일정", title: "방송 일정 준비 중", body: "확정되는 일정부터 이곳에 업데이트합니다.", date: "2026-07-14" },
];

const DEFAULT_SETTINGS: SiteSettings = {
  discordUrl: "",
  adminNicknames: ["첫째와둘째", "첫째입니다", "오늘의메뉴"],
};

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { id: "schedule-tue", day: "화", time: "20:00", title: "소통 방송" },
  { id: "schedule-thu", day: "목", time: "20:00", title: "게임 방송" },
  { id: "schedule-sat", day: "토", time: "21:00", title: "팬 참여 방송" },
];

declare global {
  var __firstAndSecondLoungeContent: LoungeContent | undefined;
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
    notices: content?.notices?.length ? content.notices : DEFAULT_NOTICES,
    schedules: content?.schedules?.length ? content.schedules : DEFAULT_SCHEDULES,
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
  const day = cleanText(value.day, 8);
  const time = cleanText(value.time, 20);
  const title = cleanText(value.title, 80);
  if (!day && !time && !title) return null;
  return {
    id: cleanText(value.id, 80) || crypto.randomUUID() || "schedule-" + Date.now() + "-" + index,
    day: day || "-",
    time: time || "미정",
    title: title || "일정 미정",
  };
}

function contentDoc() {
  return firestore().collection("loungeContent").doc("main");
}

export async function getLoungeContent() {
  if (!hasFirebaseConfig()) return withDefaults(memoryStore());

  const snapshot = await contentDoc().get();
  if (!snapshot.exists) {
    const initial = withDefaults();
    await contentDoc().set(initial);
    return initial;
  }
  return withDefaults(snapshot.data() as Partial<LoungeContent>);
}

export async function updateLoungeContent(input: { notices?: unknown[]; schedules?: unknown[]; links?: unknown; settings?: unknown }) {
  const previous = await getLoungeContent();
  const notices = Array.isArray(input.notices) ? input.notices.map(cleanNotice).filter((item): item is NoticeItem => Boolean(item)).slice(0, 100) : previous.notices;
  const schedules = Array.isArray(input.schedules) ? input.schedules.map(cleanSchedule).filter((item): item is ScheduleItem => Boolean(item)).slice(0, 8) : previous.schedules;
  const settings = cleanSettings(input.settings || { ...previous.settings, ...cleanLinks(input.links) });

  const next = withDefaults({
    notices: notices.length ? notices : DEFAULT_NOTICES,
    schedules: schedules.length ? schedules : DEFAULT_SCHEDULES,
    settings,
    updatedAt: now(),
  });

  if (!hasFirebaseConfig()) {
    globalThis.__firstAndSecondLoungeContent = next;
    return next;
  }

  await contentDoc().set(next);
  return next;
}
