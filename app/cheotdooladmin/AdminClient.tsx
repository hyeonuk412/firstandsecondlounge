"use client";

import { useEffect, useMemo, useState } from "react";

type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date: string;
};

type ScheduleItem = {
  id: string;
  date?: string;
  day: string;
  time: string;
  title: string;
};

type SiteSettings = {
  discordUrl: string;
  adminNicknames: string[];
};

type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
  settings: SiteSettings;
  links?: { discordUrl: string };
  updatedAt: string;
};

type DmMessage = {
  id: string;
  sender: "viewer" | "admin";
  message: string;
  createdAt: string;
};

type DmThread = {
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

type AdminPanel = "home" | "dms" | "notices" | "schedules" | "settings";

const DEFAULT_SETTINGS: SiteSettings = {
  discordUrl: "",
  adminNicknames: ["첫째와둘째", "첫째입니다", "오늘의메뉴"],
};

const TEXT = {
  kicker: "FIRST & SECOND ADMIN",
  title: "관리자 페이지",
  desc: "필요한 메뉴를 선택해서 관리합니다.",
  logout: "로그아웃",
  home: "처음 화면",
  dms: "DM",
  notices: "공지",
  schedules: "스케줄",
  settings: "설정",
  discordUrl: "디스코드 주소",
  adminNicknames: "관리자 닉네임",
  addNickname: "닉네임 추가",
  addNotice: "공지 추가",
  addSchedule: "일정 추가",
  save: "저장하기",
  saving: "저장 중",
  saved: "저장했어요.",
  delete: "삭제",
  tag: "태그",
  noticeTitle: "제목",
  noticeBody: "내용",
  noticeDate: "날짜",
  time: "시간",
  scheduleTitle: "일정명",
  wrongCode: "관리자 권한이 필요해요.",
  contentLoadError: "내용을 불러오지 못했어요.",
  contentSaveError: "내용을 저장하지 못했어요.",
  dmLoadError: "DM 목록을 불러오지 못했어요.",
  dmSaveError: "답변을 저장하지 못했어요.",
  dmEditError: "답변을 수정하지 못했어요.",
  refresh: "새로고침",
  refreshing: "새로고침 중",
  totalDm: "스레드",
  countSuffix: "개",
  waiting: "답변 대기",
  answered: "답변 완료",
  viewer: "시청자",
  admin: "첫째와둘째",
  replyPlaceholder: "답변을 입력하세요",
  replySave: "보내기",
  edit: "수정",
  editSave: "수정 저장",
  cancel: "취소",
  empty: "비어 있음",
  noSelection: "스레드를 선택해주세요.",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function newId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(value = new Date()) {
  return value.toISOString().slice(0, 7);
}

function emptyNotice(): NoticeItem {
  return { id: newId("notice"), tag: "공지", title: "", body: "", date: todayKey() };
}

function dayLabel(date: string) {
  const parsed = new Date(date + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return "";
  return WEEKDAYS[parsed.getDay()];
}

function emptySchedule(date = todayKey()): ScheduleItem {
  return { id: newId("schedule"), date, day: dayLabel(date), time: "", title: "" };
}

function dateFromMonth(month: string, day: number) {
  return month + "-" + String(day).padStart(2, "0");
}

function itemDate(item: ScheduleItem) {
  return item.date || "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPlainDate(value?: string) {
  if (!value) return "날짜 미정";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function firstViewerMessage(thread: DmThread) {
  return thread.messages.find((message) => message.sender === "viewer");
}

function latestMessage(thread: DmThread) {
  return thread.messages[thread.messages.length - 1];
}

function sortThreads(items: DmThread[]) {
  return items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortNotices(items: NoticeItem[]) {
  return items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function shortText(value: string, maxLength = 54) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) + "..." : normalized;
}

function calendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const last = new Date(year, monthNumber, 0);
  const cells: Array<{ key: string; day?: number; date?: string }> = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push({ key: "blank-" + index });
  }
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = dateFromMonth(month, day);
    cells.push({ key: date, day, date });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: "tail-" + cells.length });
  }
  return cells;
}

function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthKey(new Date(year, monthNumber - 1 + offset, 1));
}

export default function CheotdoolAdminClient() {
  const [activePanel, setActivePanel] = useState<AdminPanel>("home");

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [contentError, setContentError] = useState("");
  const [selectedNoticeId, setSelectedNoticeId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(monthKey());
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayKey());

  const [threads, setThreads] = useState<DmThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [query, setQuery] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editingMessageId, setEditingMessageId] = useState("");

  const sortedNoticeItems = useMemo(() => sortNotices(notices), [notices]);
  const selectedNotice = useMemo(
    () => notices.find((notice) => notice.id === selectedNoticeId) || sortedNoticeItems[0] || null,
    [notices, selectedNoticeId, sortedNoticeItems],
  );
  const monthCells = useMemo(() => calendarCells(calendarMonth), [calendarMonth]);
  const schedulesBySelectedDate = useMemo(
    () => schedules.filter((schedule) => itemDate(schedule) === selectedScheduleDate),
    [schedules, selectedScheduleDate],
  );
  const waitingCount = useMemo(() => threads.filter((thread) => thread.status === "waiting").length, [threads]);

  const filteredThreads = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return threads;
    return threads.filter((thread) => {
      const viewerName = `${thread.viewer.nickname} ${thread.viewer.channelName} ${thread.viewer.channelId}`.toLowerCase();
      const messages = thread.messages.map((message) => message.message).join(" ").toLowerCase();
      return viewerName.includes(keyword) || messages.includes(keyword);
    });
  }, [query, threads]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  async function loadContent() {
    setContentLoading(true);
    setContentError("");
    setContentSaved(false);
    try {
      const response = await fetch("/api/admin/content", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? TEXT.wrongCode : TEXT.contentLoadError);
      const payload = (await response.json()) as LoungeContent;
      const nextNotices = payload.notices || [];
      const nextSchedules = payload.schedules || [];
      setNotices(nextNotices);
      setSchedules(nextSchedules);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...payload.settings,
        discordUrl: payload.settings?.discordUrl || payload.links?.discordUrl || "",
      });
      setSelectedNoticeId((current) => current || sortNotices(nextNotices)[0]?.id || "");
    } catch (loadError) {
      setContentError(loadError instanceof Error ? loadError.message : TEXT.contentLoadError);
    } finally {
      setContentLoading(false);
    }
  }

  async function loadThreads() {
    setDmLoading(true);
    setDmError("");
    try {
      const response = await fetch("/api/admin/dms", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? TEXT.wrongCode : TEXT.dmLoadError);
      const payload = (await response.json()) as { threads: DmThread[] };
      const sortedThreads = sortThreads(payload.threads);
      setThreads(sortedThreads);
      setSelectedThreadId((current) => current && sortedThreads.some((thread) => thread.id === current) ? current : sortedThreads[0]?.id || "");
    } catch (loadError) {
      setDmError(loadError instanceof Error ? loadError.message : TEXT.dmLoadError);
    } finally {
      setDmLoading(false);
    }
  }

  useEffect(() => {
    loadContent();
    loadThreads();
  }, []);

  async function saveContent() {
    const cleanSettings = {
      ...settings,
      adminNicknames: Array.from(new Set(settings.adminNicknames.map((item) => item.trim()).filter(Boolean))),
    };
    const normalizedSchedules = schedules.map((schedule) => ({
      ...schedule,
      day: schedule.date ? dayLabel(schedule.date) : schedule.day,
    }));

    setContentSaving(true);
    setContentError("");
    setContentSaved(false);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notices, schedules: normalizedSchedules, settings: cleanSettings }),
    });

    if (!response.ok) {
      setContentSaving(false);
      setContentError(TEXT.contentSaveError);
      return;
    }

    const payload = (await response.json()) as LoungeContent;
    setNotices(payload.notices || []);
    setSchedules(payload.schedules || []);
    setSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
    setContentSaving(false);
    setContentSaved(true);
  }

  function openThread(threadId: string) {
    setSelectedThreadId(threadId);
    setEditingMessageId("");
    setDmError("");
  }

  async function submitReply(threadId: string) {
    const message = replyDrafts[threadId]?.trim() || "";
    if (!message) return;
    setDmError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      setDmError(TEXT.dmSaveError);
      return;
    }
    const payload = (await response.json()) as { thread: DmThread };
    setThreads((items) => sortThreads(items.map((item) => item.id === threadId ? payload.thread : item)));
    setSelectedThreadId(payload.thread.id);
    setReplyDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
  }

  function startEdit(message: DmMessage) {
    setEditingMessageId(message.id);
    setEditDrafts((drafts) => ({ ...drafts, [message.id]: message.message }));
  }

  async function submitEditReply(threadId: string, messageId: string) {
    const message = editDrafts[messageId]?.trim() || "";
    if (!message) return;
    setDmError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, message }),
    });
    if (!response.ok) {
      setDmError(TEXT.dmEditError);
      return;
    }
    const payload = (await response.json()) as { thread: DmThread };
    setThreads((items) => items.map((item) => item.id === threadId ? payload.thread : item));
    setEditingMessageId("");
  }

  function addNotice() {
    const notice = emptyNotice();
    setNotices((items) => [notice, ...items]);
    setSelectedNoticeId(notice.id);
  }

  function updateNotice(id: string, patch: Partial<NoticeItem>) {
    setNotices((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeNotice(id: string) {
    setNotices((items) => items.filter((item) => item.id !== id));
    setSelectedNoticeId("");
  }

  function addSchedule() {
    const schedule = emptySchedule(selectedScheduleDate);
    setSchedules((items) => [...items, schedule]);
  }

  function updateSchedule(id: string, patch: Partial<ScheduleItem>) {
    setSchedules((items) => items.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      return { ...next, day: next.date ? dayLabel(next.date) : next.day };
    }));
  }

  function removeSchedule(id: string) {
    setSchedules((items) => items.filter((item) => item.id !== id));
  }

  function updateAdminNickname(index: number, value: string) {
    setSettings((current) => ({
      ...current,
      adminNicknames: current.adminNicknames.map((item, itemIndex) => itemIndex === index ? value : item),
    }));
  }

  function removeAdminNickname(index: number) {
    setSettings((current) => ({
      ...current,
      adminNicknames: current.adminNicknames.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function openPanel(panel: AdminPanel) {
    setActivePanel(panel);
    setContentSaved(false);
  }

  return (
    <main className="admin-page cheotdool-admin-page">
      <header className="admin-header">
        <div>
          <p className="kicker">{TEXT.kicker}</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.desc}</p>
        </div>
        <div className="admin-header-actions">
          <a href="/">라운지로</a>
          <a href="/api/auth/chzzk/logout">{TEXT.logout}</a>
        </div>
      </header>

      <nav className="admin-unified-tabs" aria-label="관리 메뉴">
        <button className={activePanel === "home" ? "active" : ""} type="button" onClick={() => openPanel("home")}>{TEXT.home}</button>
        <button className={activePanel === "dms" ? "active" : ""} type="button" onClick={() => openPanel("dms")}>{TEXT.dms}</button>
        <button className={activePanel === "notices" ? "active" : ""} type="button" onClick={() => openPanel("notices")}>{TEXT.notices}</button>
        <button className={activePanel === "schedules" ? "active" : ""} type="button" onClick={() => openPanel("schedules")}>{TEXT.schedules}</button>
        <button className={activePanel === "settings" ? "active" : ""} type="button" onClick={() => openPanel("settings")}>{TEXT.settings}</button>
      </nav>

      {activePanel === "home" ? (
        <section className="admin-home-grid" aria-label="관리자 첫 화면">
          <button type="button" className="admin-home-card" onClick={() => openPanel("dms")}>
            <span>DIRECT MESSAGE</span>
            <strong>{threads.length}{TEXT.countSuffix}</strong>
            <small>{waitingCount > 0 ? waitingCount + TEXT.countSuffix + " 답변 대기" : "DM 확인하기"}</small>
          </button>
          <button type="button" className="admin-home-card" onClick={() => openPanel("notices")}>
            <span>NOTICE</span>
            <strong>{notices.length}{TEXT.countSuffix}</strong>
            <small>공지 목록 관리</small>
          </button>
          <button type="button" className="admin-home-card" onClick={() => openPanel("schedules")}>
            <span>SCHEDULE</span>
            <strong>{schedules.length}{TEXT.countSuffix}</strong>
            <small>달력에서 일정 관리</small>
          </button>
          <button type="button" className="admin-home-card" onClick={() => openPanel("settings")}>
            <span>SETTING</span>
            <strong>{settings.adminNicknames.length}{TEXT.countSuffix}</strong>
            <small>관리자/디스코드 설정</small>
          </button>
        </section>
      ) : null}

      {activePanel === "dms" ? (
        <section className="admin-messenger" aria-label="관리자 DM">
          <aside className="admin-messenger-sidebar">
            <div className="admin-messenger-head">
              <div>
                <p className="kicker">DIRECT MESSAGE</p>
                <h2>{TEXT.totalDm} <span>{threads.length}{TEXT.countSuffix}</span></h2>
              </div>
              <button type="button" onClick={() => loadThreads()} disabled={dmLoading}>{dmLoading ? TEXT.refreshing : TEXT.refresh}</button>
            </div>
            <label className="admin-dm-search">
              <span className="visually-hidden">DM 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 내용 검색" />
            </label>
            <div className="admin-thread-list" aria-label="DM 스레드 목록">
              {filteredThreads.length > 0 ? filteredThreads.map((thread) => {
                const firstMessage = firstViewerMessage(thread);
                const latest = latestMessage(thread) || firstMessage;
                const viewerName = thread.viewer.nickname || thread.viewer.channelName || TEXT.viewer;
                const active = selectedThreadId === thread.id;
                return (
                  <button className={`admin-thread-card ${active ? "active" : ""} ${thread.status === "waiting" ? "waiting" : ""}`} type="button" onClick={() => openThread(thread.id)} key={thread.id}>
                    <span className="admin-thread-avatar">{viewerName.slice(0, 1)}</span>
                    <span className="admin-thread-body">
                      <span className="admin-thread-topline"><strong>{viewerName}</strong><time>{formatDate(thread.updatedAt)}</time></span>
                      <span className="admin-thread-topic">{shortText(firstMessage?.message || latest?.message || "")}</span>
                      <span className="admin-thread-preview">{latest?.sender === "admin" ? TEXT.admin + ": " : ""}{shortText(latest?.message || "")}</span>
                    </span>
                    <em>{thread.status === "answered" ? TEXT.answered : TEXT.waiting}</em>
                  </button>
                );
              }) : <div className="admin-thread-empty">{TEXT.empty}</div>}
            </div>
          </aside>
          <section className="admin-chat-panel">
            {selectedThread ? (
              <>
                <div className="admin-chat-head">
                  <div className="admin-chat-profile">
                    <span className="admin-thread-avatar large">{(selectedThread.viewer.nickname || selectedThread.viewer.channelName || TEXT.viewer).slice(0, 1)}</span>
                    <div><strong>{selectedThread.viewer.nickname || selectedThread.viewer.channelName}</strong><span>{selectedThread.viewer.channelId}</span></div>
                  </div>
                  <em className={selectedThread.status === "waiting" ? "waiting" : ""}>{selectedThread.status === "answered" ? TEXT.answered : TEXT.waiting}</em>
                </div>
                <div className="admin-chat-messages" aria-label="DM 대화 내용">
                  {selectedThread.messages.map((message) => {
                    const isAdminMessage = message.sender === "admin";
                    const isEditing = editingMessageId === message.id;
                    return (
                      <article className={`admin-chat-row ${isAdminMessage ? "mine" : "theirs"}`} key={message.id}>
                        <div className="admin-chat-bubble">
                          <div className="admin-chat-bubble-head">
                            <strong>{isAdminMessage ? TEXT.admin : selectedThread.viewer.nickname || selectedThread.viewer.channelName}</strong>
                            {isAdminMessage && !isEditing ? <button type="button" onClick={() => startEdit(message)}>{TEXT.edit}</button> : null}
                          </div>
                          {isEditing ? (
                            <div className="admin-edit-reply in-chat">
                              <textarea value={editDrafts[message.id] || ""} onChange={(event) => setEditDrafts((drafts) => ({ ...drafts, [message.id]: event.target.value }))} rows={3} />
                              <div><button type="button" onClick={() => submitEditReply(selectedThread.id, message.id)}>{TEXT.editSave}</button><button type="button" className="secondary" onClick={() => setEditingMessageId("")}>{TEXT.cancel}</button></div>
                            </div>
                          ) : <p>{message.message}</p>}
                          <time>{formatDate(message.createdAt)}</time>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <form className="admin-chat-reply" onSubmit={(event) => { event.preventDefault(); submitReply(selectedThread.id); }}>
                  <textarea value={replyDrafts[selectedThread.id] || ""} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [selectedThread.id]: event.target.value }))} placeholder={TEXT.replyPlaceholder} rows={2} />
                  <button type="submit">{TEXT.replySave}</button>
                </form>
              </>
            ) : <div className="admin-chat-empty">{TEXT.noSelection}</div>}
            {dmError ? <p className="admin-chat-error">{dmError}</p> : null}
          </section>
        </section>
      ) : null}

      {activePanel === "notices" ? (
        <section className="admin-dm-shell admin-content-shell">
          <div className="admin-toolbar">
            <strong>{contentLoading ? "Loading" : TEXT.notices}</strong>
            <button type="button" onClick={saveContent} disabled={contentSaving}>{contentSaving ? TEXT.saving : TEXT.save}</button>
          </div>
          {contentSaved ? <p className="sent">{TEXT.saved}</p> : null}
          {contentError ? <p className="dm-error">{contentError}</p> : null}
          <div className="admin-notice-manager">
            <section className="admin-notice-list-panel">
              <div className="admin-section-head"><h2>{TEXT.notices}</h2><button type="button" onClick={addNotice}>{TEXT.addNotice}</button></div>
              <div className="admin-notice-list">
                {sortedNoticeItems.length ? sortedNoticeItems.map((notice) => (
                  <button className={selectedNotice?.id === notice.id ? "active" : ""} type="button" onClick={() => setSelectedNoticeId(notice.id)} key={notice.id}>
                    <span>{notice.tag || "공지"}</span>
                    <strong>{notice.title || "제목 없음"}</strong>
                    <time>{formatPlainDate(notice.date)}</time>
                  </button>
                )) : <div className="admin-empty">{TEXT.empty}</div>}
              </div>
            </section>
            <section className="admin-notice-editor">
              {selectedNotice ? (
                <article className="admin-edit-card">
                  <div className="admin-edit-row notice-row">
                    <label>{TEXT.tag}<input value={selectedNotice.tag} onChange={(event) => updateNotice(selectedNotice.id, { tag: event.target.value })} /></label>
                    <label>{TEXT.noticeDate}<input type="date" value={selectedNotice.date || ""} onChange={(event) => updateNotice(selectedNotice.id, { date: event.target.value })} /></label>
                  </div>
                  <label>{TEXT.noticeTitle}<input value={selectedNotice.title} onChange={(event) => updateNotice(selectedNotice.id, { title: event.target.value })} /></label>
                  <label>{TEXT.noticeBody}<textarea rows={8} value={selectedNotice.body} onChange={(event) => updateNotice(selectedNotice.id, { body: event.target.value })} /></label>
                  <button className="admin-danger" type="button" onClick={() => removeNotice(selectedNotice.id)}>{TEXT.delete}</button>
                </article>
              ) : <div className="admin-empty">공지를 선택하거나 추가해주세요.</div>}
            </section>
          </div>
        </section>
      ) : null}

      {activePanel === "schedules" ? (
        <section className="admin-dm-shell admin-content-shell">
          <div className="admin-toolbar">
            <strong>{contentLoading ? "Loading" : TEXT.schedules}</strong>
            <button type="button" onClick={saveContent} disabled={contentSaving}>{contentSaving ? TEXT.saving : TEXT.save}</button>
          </div>
          {contentSaved ? <p className="sent">{TEXT.saved}</p> : null}
          {contentError ? <p className="dm-error">{contentError}</p> : null}
          <div className="admin-calendar-layout">
            <section className="admin-calendar-panel">
              <div className="admin-calendar-head">
                <button type="button" onClick={() => setCalendarMonth((current) => moveMonth(current, -1))}>이전</button>
                <strong>{calendarMonth}</strong>
                <button type="button" onClick={() => setCalendarMonth((current) => moveMonth(current, 1))}>다음</button>
              </div>
              <div className="admin-calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="admin-calendar-grid">
                {monthCells.map((cell) => {
                  const daySchedules = cell.date ? schedules.filter((schedule) => itemDate(schedule) === cell.date) : [];
                  return cell.date ? (
                    <button className={selectedScheduleDate === cell.date ? "active" : ""} type="button" onClick={() => setSelectedScheduleDate(cell.date || todayKey())} key={cell.key}>
                      <strong>{cell.day}</strong>
                      {daySchedules.length ? <span>{daySchedules.length}</span> : null}
                    </button>
                  ) : <span className="blank" key={cell.key} />;
                })}
              </div>
            </section>
            <section className="admin-schedule-editor">
              <div className="admin-section-head"><h2>{formatPlainDate(selectedScheduleDate)}</h2><button type="button" onClick={addSchedule}>{TEXT.addSchedule}</button></div>
              <div className="admin-edit-list">
                {schedulesBySelectedDate.length ? schedulesBySelectedDate.map((schedule) => (
                  <article className="admin-edit-card" key={schedule.id}>
                    <div className="admin-edit-row schedule-row">
                      <label>{TEXT.noticeDate}<input type="date" value={schedule.date || selectedScheduleDate} onChange={(event) => updateSchedule(schedule.id, { date: event.target.value })} /></label>
                      <label>{TEXT.time}<input value={schedule.time} onChange={(event) => updateSchedule(schedule.id, { time: event.target.value })} placeholder="20:00" /></label>
                      <label>{TEXT.scheduleTitle}<input value={schedule.title} onChange={(event) => updateSchedule(schedule.id, { title: event.target.value })} /></label>
                    </div>
                    <button className="admin-danger" type="button" onClick={() => removeSchedule(schedule.id)}>{TEXT.delete}</button>
                  </article>
                )) : <div className="admin-empty">선택한 날짜에 일정이 없어요.</div>}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {activePanel === "settings" ? (
        <section className="admin-dm-shell admin-content-shell">
          <div className="admin-toolbar">
            <strong>{contentLoading ? "Loading" : TEXT.settings}</strong>
            <button type="button" onClick={saveContent} disabled={contentSaving}>{contentSaving ? TEXT.saving : TEXT.save}</button>
          </div>
          {contentSaved ? <p className="sent">{TEXT.saved}</p> : null}
          {contentError ? <p className="dm-error">{contentError}</p> : null}
          <section className="admin-content-section">
            <div className="admin-section-head"><h2>{TEXT.settings}</h2></div>
            <article className="admin-edit-card">
              <label>{TEXT.discordUrl}<input value={settings.discordUrl} onChange={(event) => setSettings((current) => ({ ...current, discordUrl: event.target.value }))} placeholder="https://discord.gg/..." /></label>
            </article>
            <div className="admin-section-head"><h2>{TEXT.adminNicknames}</h2><button type="button" onClick={() => setSettings((current) => ({ ...current, adminNicknames: [...current.adminNicknames, ""] }))}>{TEXT.addNickname}</button></div>
            <div className="admin-edit-list">
              {settings.adminNicknames.map((nickname, index) => (
                <article className="admin-edit-card admin-nickname-card" key={`${nickname}-${index}`}>
                  <label>{TEXT.adminNicknames}<input value={nickname} onChange={(event) => updateAdminNickname(index, event.target.value)} placeholder="치지직 닉네임" /></label>
                  <button className="admin-danger" type="button" onClick={() => removeAdminNickname(index)}>{TEXT.delete}</button>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}