export type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
};

export type ScheduleItem = {
  id: string;
  day: string;
  time: string;
  title: string;
};

export type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
  updatedAt: string;
};

const DEFAULT_NOTICES: NoticeItem[] = [
  { id: "notice-open", tag: "\uACF5\uC9C0", title: "\uD32C \uB77C\uC6B4\uC9C0 \uC624\uD508", body: "\uBC29\uC1A1 \uB9C1\uD06C\uC640 DM \uCC3D\uAD6C\uB97C \uBA3C\uC800 \uC5F4\uC5B4\uB450\uC5C8\uC5B4\uC694." },
  { id: "notice-login", tag: "DM", title: "\uCE58\uC9C0\uC9C1 \uB85C\uADF8\uC778 \uD544\uC694", body: "DM\uACFC \uB2F5\uBCC0\uD568\uC740 \uCE58\uC9C0\uC9C1 \uACC4\uC815 \uAE30\uC900\uC73C\uB85C \uC5F0\uACB0\uB429\uB2C8\uB2E4." },
  { id: "notice-schedule", tag: "\uC77C\uC815", title: "\uBC29\uC1A1 \uC77C\uC815 \uC900\uBE44 \uC911", body: "\uD655\uC815\uB418\uB294 \uC77C\uC815\uBD80\uD130 \uC774\uACF3\uC5D0 \uC5C5\uB370\uC774\uD2B8\uD569\uB2C8\uB2E4." },
];

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { id: "schedule-tue", day: "\uD654", time: "20:00", title: "\uC18C\uD1B5 \uBC29\uC1A1" },
  { id: "schedule-thu", day: "\uBAA9", time: "20:00", title: "\uAC8C\uC784 \uBC29\uC1A1" },
  { id: "schedule-sat", day: "\uD1A0", time: "21:00", title: "\uD32C \uCC38\uC5EC \uBC29\uC1A1" },
];

declare global {
  var __firstAndSecondLoungeContent: LoungeContent | undefined;
}

function now() {
  return new Date().toISOString();
}

function withDefaults(content?: Partial<LoungeContent>): LoungeContent {
  return {
    notices: content?.notices?.length ? content.notices : DEFAULT_NOTICES,
    schedules: content?.schedules?.length ? content.schedules : DEFAULT_SCHEDULES,
    updatedAt: content?.updatedAt || now(),
  };
}

function store() {
  globalThis.__firstAndSecondLoungeContent ??= withDefaults();
  return globalThis.__firstAndSecondLoungeContent;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanNotice(item: unknown, index: number): NoticeItem | null {
  const value = item as Partial<NoticeItem>;
  const tag = cleanText(value.tag, 12) || "\uACF5\uC9C0";
  const title = cleanText(value.title, 80);
  const body = cleanText(value.body, 280);
  if (!title && !body) return null;
  return {
    id: cleanText(value.id, 80) || crypto.randomUUID() || "notice-" + Date.now() + "-" + index,
    tag,
    title: title || "\uC81C\uBAA9 \uC5C6\uC74C",
    body,
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
    time: time || "\uBBF8\uC815",
    title: title || "\uC77C\uC815 \uBBF8\uC815",
  };
}

export function getLoungeContent() {
  return withDefaults(store());
}

export function updateLoungeContent(input: { notices?: unknown[]; schedules?: unknown[] }) {
  const notices = Array.isArray(input.notices) ? input.notices.map(cleanNotice).filter((item): item is NoticeItem => Boolean(item)).slice(0, 8) : DEFAULT_NOTICES;
  const schedules = Array.isArray(input.schedules) ? input.schedules.map(cleanSchedule).filter((item): item is ScheduleItem => Boolean(item)).slice(0, 8) : DEFAULT_SCHEDULES;

  globalThis.__firstAndSecondLoungeContent = {
    notices: notices.length ? notices : DEFAULT_NOTICES,
    schedules: schedules.length ? schedules : DEFAULT_SCHEDULES,
    updatedAt: now(),
  };
  return globalThis.__firstAndSecondLoungeContent;
}
