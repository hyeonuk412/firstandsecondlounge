"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date: string;
};

type ScheduleItem = {
  id: string;
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

const DEFAULT_SETTINGS: SiteSettings = {
  discordUrl: "",
  adminNicknames: ["첫째와둘째", "첫째입니다", "오늘의메뉴"],
};

const TEXT = {
  kicker: "FIRST & SECOND ADMIN",
  title: "관리자 페이지",
  desc: "공지, 스케줄, 설정, DM을 한 곳에서 관리합니다.",
  logout: "관리자 로그아웃",
  adminCode: "관리자 코드",
  adminPlaceholder: "관리자 코드를 입력하세요",
  login: "관리 화면 열기",
  dms: "DM",
  notices: "공지",
  schedules: "스케줄",
  settings: "설정",
  discordUrl: "디스코드 주소",
  adminNicknames: "관리자 닉네임",
  addNickname: "닉네임 추가",
  addNotice: "공지 추가",
  addSchedule: "스케줄 추가",
  save: "저장하기",
  saving: "저장 중",
  saved: "저장했어요.",
  delete: "삭제",
  tag: "태그",
  noticeTitle: "제목",
  noticeBody: "내용",
  noticeDate: "날짜",
  day: "요일",
  time: "시간",
  scheduleTitle: "일정명",
  wrongCode: "관리자 코드가 맞지 않아요.",
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

function newId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyNotice(): NoticeItem {
  return { id: newId("notice"), tag: "공지", title: "", body: "", date: new Date().toISOString().slice(0, 10) };
}

function emptySchedule(): ScheduleItem {
  return { id: newId("schedule"), day: "", time: "", title: "" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function shortText(value: string, maxLength = 54) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export default function CheotdoolAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [activePanel, setActivePanel] = useState<"dms" | "notices" | "schedules" | "settings">("dms");

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [contentError, setContentError] = useState("");

  const [threads, setThreads] = useState<DmThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [query, setQuery] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editingMessageId, setEditingMessageId] = useState("");

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

  async function loadContent(nextToken = token) {
    if (!nextToken) return;
    setContentLoading(true);
    setContentError("");
    setContentSaved(false);
    try {
      const response = await fetch("/api/admin/content", {
        cache: "no-store",
        headers: { "x-admin-token": nextToken },
      });
      if (!response.ok) throw new Error(response.status === 401 ? TEXT.wrongCode : TEXT.contentLoadError);
      const payload = (await response.json()) as LoungeContent;
      setNotices(payload.notices);
      setSchedules(payload.schedules);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...payload.settings,
        discordUrl: payload.settings?.discordUrl || payload.links?.discordUrl || "",
      });
    } catch (loadError) {
      setContentError(loadError instanceof Error ? loadError.message : TEXT.contentLoadError);
    } finally {
      setContentLoading(false);
    }
  }

  async function loadThreads(nextToken = token) {
    if (!nextToken) return;
    setDmLoading(true);
    setDmError("");
    try {
      const response = await fetch("/api/admin/dms", {
        cache: "no-store",
        headers: { "x-admin-token": nextToken },
      });
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
    const savedToken = window.sessionStorage.getItem("firstandsecond:admin-token") || "";
    if (savedToken) {
      setToken(savedToken);
      setTokenInput(savedToken);
      loadContent(savedToken);
      loadThreads(savedToken);
    }
  }, []);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    window.sessionStorage.setItem("firstandsecond:admin-token", nextToken);
    setToken(nextToken);
    loadContent(nextToken);
    loadThreads(nextToken);
  }

  function handleLogout() {
    window.sessionStorage.removeItem("firstandsecond:admin-token");
    setToken("");
    setTokenInput("");
    setNotices([]);
    setSchedules([]);
    setSettings(DEFAULT_SETTINGS);
    setThreads([]);
    setSelectedThreadId("");
    setQuery("");
    setContentError("");
    setDmError("");
    setContentSaved(false);
  }

  async function saveContent() {
    if (!token) return;
    const cleanSettings = {
      ...settings,
      adminNicknames: Array.from(new Set(settings.adminNicknames.map((item) => item.trim()).filter(Boolean))),
    };
    setContentSaving(true);
    setContentError("");
    setContentSaved(false);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ notices, schedules, settings: cleanSettings }),
    });

    if (!response.ok) {
      setContentSaving(false);
      setContentError(TEXT.contentSaveError);
      return;
    }

    const payload = (await response.json()) as LoungeContent;
    setNotices(payload.notices);
    setSchedules(payload.schedules);
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
    if (!message || !token) return;
    setDmError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
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
    if (!message || !token) return;
    setDmError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
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
          {token ? <button type="button" onClick={handleLogout}>{TEXT.logout}</button> : null}
        </div>
      </header>

      {!token ? (
        <form className="admin-login" onSubmit={handleLogin}>
          <label>
            {TEXT.adminCode}
            <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder={TEXT.adminPlaceholder} />
          </label>
          <button type="submit">{TEXT.login}</button>
          {contentError || dmError ? <p className="dm-error">{contentError || dmError}</p> : null}
        </form>
      ) : (
        <>
          <nav className="admin-unified-tabs" aria-label="관리 메뉴">
            <button className={activePanel === "dms" ? "active" : ""} type="button" onClick={() => setActivePanel("dms")}>{TEXT.dms}</button>
            <button className={activePanel === "notices" ? "active" : ""} type="button" onClick={() => setActivePanel("notices")}>{TEXT.notices}</button>
            <button className={activePanel === "schedules" ? "active" : ""} type="button" onClick={() => setActivePanel("schedules")}>{TEXT.schedules}</button>
            <button className={activePanel === "settings" ? "active" : ""} type="button" onClick={() => setActivePanel("settings")}>{TEXT.settings}</button>
          </nav>

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
                          <span className="admin-thread-preview">{latest?.sender === "admin" ? `${TEXT.admin}: ` : ""}{shortText(latest?.message || "")}</span>
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
          ) : (
            <section className="admin-dm-shell admin-content-shell">
              <div className="admin-toolbar">
                <strong>{contentLoading ? "Loading" : activePanel === "notices" ? TEXT.notices : activePanel === "schedules" ? TEXT.schedules : TEXT.settings}</strong>
                <button type="button" onClick={saveContent} disabled={contentSaving}>{contentSaving ? TEXT.saving : TEXT.save}</button>
              </div>
              {contentSaved ? <p className="sent">{TEXT.saved}</p> : null}
              {contentError ? <p className="dm-error">{contentError}</p> : null}

              {activePanel === "notices" ? (
                <section className="admin-content-section">
                  <div className="admin-section-head"><h2>{TEXT.notices}</h2><button type="button" onClick={() => setNotices((items) => [...items, emptyNotice()])}>{TEXT.addNotice}</button></div>
                  <div className="admin-edit-list">
                    {notices.map((notice, index) => (
                      <article className="admin-edit-card" key={notice.id}>
                        <div className="admin-edit-row notice-row">
                          <label>{TEXT.tag}<input value={notice.tag} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, tag: event.target.value } : item))} /></label>
                          <label>{TEXT.noticeTitle}<input value={notice.title} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                          <label>{TEXT.noticeDate}<input type="date" value={notice.date || ""} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value } : item))} /></label>
                        </div>
                        <label>{TEXT.noticeBody}<textarea rows={4} value={notice.body} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} /></label>
                        <button className="admin-danger" type="button" onClick={() => setNotices((items) => items.filter((_, itemIndex) => itemIndex !== index))}>{TEXT.delete}</button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activePanel === "schedules" ? (
                <section className="admin-content-section">
                  <div className="admin-section-head"><h2>{TEXT.schedules}</h2><button type="button" onClick={() => setSchedules((items) => [...items, emptySchedule()])}>{TEXT.addSchedule}</button></div>
                  <div className="admin-edit-list">
                    {schedules.map((schedule, index) => (
                      <article className="admin-edit-card" key={schedule.id}>
                        <div className="admin-edit-row schedule-row">
                          <label>{TEXT.day}<input value={schedule.day} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value } : item))} /></label>
                          <label>{TEXT.time}<input value={schedule.time} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, time: event.target.value } : item))} /></label>
                          <label>{TEXT.scheduleTitle}<input value={schedule.title} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                        </div>
                        <button className="admin-danger" type="button" onClick={() => setSchedules((items) => items.filter((_, itemIndex) => itemIndex !== index))}>{TEXT.delete}</button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activePanel === "settings" ? (
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
              ) : null}
            </section>
          )}
        </>
      )}
    </main>
  );
}
