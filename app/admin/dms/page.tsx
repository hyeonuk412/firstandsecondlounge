"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const TEXT = {
  title: "DM \uAD00\uB9AC",
  desc: "\uD32C \uB77C\uC6B4\uC9C0\uC5D0\uC11C \uB4E4\uC5B4\uC628 DM\uC744 \uB0A0\uC9DC\uBCC4\uB85C \uD655\uC778\uD558\uACE0 \uB2F5\uBCC0\uD569\uB2C8\uB2E4.",
  contentLink: "\uACF5\uC9C0 / \uC2A4\uCF00\uC904",
  logout: "\uAD00\uB9AC\uC790 \uB85C\uADF8\uC544\uC6C3",
  adminCode: "\uAD00\uB9AC\uC790 \uCF54\uB4DC",
  adminPlaceholder: "\uAD00\uB9AC\uC790 \uCF54\uB4DC\uB97C \uC785\uB825\uD558\uC138\uC694",
  login: "DM \uD655\uC778\uD558\uAE30",
  wrongCode: "\uAD00\uB9AC\uC790 \uCF54\uB4DC\uAC00 \uB9DE\uC9C0 \uC54A\uC544\uC694.",
  loadError: "DM \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  saveError: "\uB2F5\uBCC0\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  editError: "\uB2F5\uBCC0\uC744 \uC218\uC815\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  refresh: "\uC0C8\uB85C\uACE0\uCE68",
  refreshing: "\uC0C8\uB85C\uACE0\uCE68 \uC911",
  all: "\uC804\uCCB4",
  allDates: "\uC804\uCCB4 \uB0A0\uC9DC",
  selectedEmpty: "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uB4E4\uC5B4\uC628 DM\uC774 \uC5C6\uC5B4\uC694.",
  totalDm: "\uC804\uCCB4 DM",
  countSuffix: "\uAC1C",
  waiting: "\uB2F5\uBCC0 \uB300\uAE30",
  answered: "\uB2F5\uBCC0 \uC644\uB8CC",
  viewer: "\uC2DC\uCCAD\uC790",
  admin: "\uAD00\uB9AC\uC790",
  firstReceived: "\uCCAB DM",
  latestActivity: "\uCD5C\uADFC \uD65C\uB3D9",
  replyPlaceholder: "\uB2F5\uBCC0\uC744 \uC785\uB825\uD558\uC138\uC694",
  replySave: "\uB2F5\uBCC0 \uC800\uC7A5",
  edit: "\uC218\uC815",
  editSave: "\uC218\uC815 \uC800\uC7A5",
  cancel: "\uCDE8\uC18C",
  empty: "\uC544\uC9C1 \uB4E4\uC5B4\uC628 DM\uC774 \uC5C6\uC5B4\uC694.",
};

const categoryLabels: Record<string, string> = {
  support: "\uC751\uC6D0",
  question: "\uBB38\uC758",
  suggestion: "\uC81C\uC548",
  business: "\uC81C\uD734",
  etc: "\uAE30\uD0C0",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function dayKey(value: string) {
  const date = new Date(value);
  return calendarKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(value);
}

function shiftMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function calendarKey(year: number, month: number, day: number) {
  return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function firstViewerMessage(thread: DmThread) {
  return thread.messages.find((message) => message.sender === "viewer");
}

function latestAdminReply(thread: DmThread) {
  return thread.messages.filter((message) => message.sender === "admin").at(-1);
}

export default function AdminDmsPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editingMessageId, setEditingMessageId] = useState("");
  const [activeDate, setActiveDate] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const dateGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; threads: DmThread[] }>();
    for (const thread of threads) {
      const receivedAt = firstViewerMessage(thread)?.createdAt || thread.createdAt;
      const key = dayKey(receivedAt);
      const current = groups.get(key) || { key, label: formatDay(receivedAt), threads: [] };
      current.threads.push(thread);
      groups.set(key, current);
    }

    return Array.from(groups.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((group) => ({
        ...group,
        threads: group.threads.slice().sort((a, b) => (firstViewerMessage(b)?.createdAt || b.createdAt).localeCompare(firstViewerMessage(a)?.createdAt || a.createdAt)),
      }));
  }, [threads]);

  const dateGroupMap = useMemo(() => new Map(dateGroups.map((group) => [group.key, group])), [dateGroups]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = calendarKey(date.getFullYear(), date.getMonth(), date.getDate());
      const count = dateGroupMap.get(key)?.threads.length || 0;
      return { key, day: date.getDate(), currentMonth: date.getMonth() === month, count };
    });
  }, [calendarMonth, dateGroupMap]);

  const visibleGroups = activeDate === "all" ? dateGroups : dateGroups.filter((group) => group.key === activeDate);

  async function loadThreads(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dms", {
        cache: "no-store",
        headers: { "x-admin-token": nextToken },
      });
      if (!response.ok) throw new Error(response.status === 401 ? TEXT.wrongCode : TEXT.loadError);
      const payload = (await response.json()) as { threads: DmThread[] };
      setThreads(payload.threads);
      const latestThread = payload.threads[0];
      if (latestThread) {
        const receivedAt = firstViewerMessage(latestThread)?.createdAt || latestThread.createdAt;
        setCalendarMonth(new Date(receivedAt));
      }
      if (activeDate !== "all" && !payload.threads.some((thread) => dayKey(firstViewerMessage(thread)?.createdAt || thread.createdAt) === activeDate)) {
        setActiveDate("all");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : TEXT.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem("firstandsecond:admin-token") || "";
    if (saved) {
      setToken(saved);
      setTokenInput(saved);
      loadThreads(saved);
    }
  }, []);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    window.sessionStorage.setItem("firstandsecond:admin-token", nextToken);
    setToken(nextToken);
    loadThreads(nextToken);
  }

  function handleLogout() {
    window.sessionStorage.removeItem("firstandsecond:admin-token");
    setToken("");
    setTokenInput("");
    setThreads([]);
    setError("");
    setActiveDate("all");
    setCalendarMonth(new Date());
  }

  async function submitReply(threadId: string) {
    const message = replyDrafts[threadId]?.trim() || "";
    if (!message || !token) return;

    setError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      setError(TEXT.saveError);
      return;
    }

    const payload = (await response.json()) as { thread: DmThread };
    setThreads((items) => items.map((item) => item.id === threadId ? payload.thread : item));
    setReplyDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
  }

  function startEdit(message: DmMessage) {
    setEditingMessageId(message.id);
    setEditDrafts((drafts) => ({ ...drafts, [message.id]: message.message }));
  }

  async function submitEditReply(threadId: string, messageId: string) {
    const message = editDrafts[messageId]?.trim() || "";
    if (!message || !token) return;

    setError("");
    const response = await fetch(`/api/admin/dms/${encodeURIComponent(threadId)}/reply`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ messageId, message }),
    });

    if (!response.ok) {
      setError(TEXT.editError);
      return;
    }

    const payload = (await response.json()) as { thread: DmThread };
    setThreads((items) => items.map((item) => item.id === threadId ? payload.thread : item));
    setEditingMessageId("");
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="kicker">FIRST & SECOND ADMIN</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.desc}</p>
        </div>
        <div className="admin-header-actions">
          <a href="/admin/content">{TEXT.contentLink}</a>
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
          {error ? <p className="dm-error">{error}</p> : null}
        </form>
      ) : (
        <section className="admin-dm-shell">
          <div className="admin-toolbar">
            <strong>{TEXT.totalDm} {threads.length}{TEXT.countSuffix}</strong>
            <button type="button" onClick={() => loadThreads()} disabled={loading}>{loading ? TEXT.refreshing : TEXT.refresh}</button>
          </div>
          {error ? <p className="dm-error">{error}</p> : null}

          <div className="admin-calendar" aria-label="DM calendar filter">
            <div className="admin-calendar-head">
              <button type="button" onClick={() => setCalendarMonth((value) => shiftMonth(value, -1))} aria-label="previous month">&lt;</button>
              <strong>{monthLabel(calendarMonth)}</strong>
              <button type="button" onClick={() => setCalendarMonth((value) => shiftMonth(value, 1))} aria-label="next month">&gt;</button>
            </div>
            <button className={activeDate === "all" ? "admin-calendar-all active" : "admin-calendar-all"} type="button" onClick={() => setActiveDate("all")}>
              {TEXT.allDates} <span>{threads.length}</span>
            </button>
            <div className="admin-calendar-weekdays" aria-hidden="true">
              {["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="admin-calendar-grid">
              {calendarDays.map((day) => {
                const hasDms = day.count > 0;
                const isActive = activeDate === day.key;
                return (
                  <button
                    className={[day.currentMonth ? "" : "muted", hasDms ? "has-dms" : "", isActive ? "active" : ""].filter(Boolean).join(" ")}
                    type="button"
                    disabled={!hasDms}
                    onClick={() => setActiveDate(day.key)}
                    key={day.key}
                  >
                    <span>{day.day}</span>
                    {hasDms ? <em>{day.count}</em> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-dm-list by-date">
            {visibleGroups.length > 0 ? visibleGroups.map((group) => (
              <section className="admin-date-section" key={group.key}>
                <div className="admin-date-heading">
                  <h2>{group.label}</h2>
                  <span>{group.threads.length}{TEXT.countSuffix}</span>
                </div>

                {group.threads.map((thread) => {
                  const firstMessage = firstViewerMessage(thread);
                  const latestReply = latestAdminReply(thread);
                  return (
                    <article className="admin-dm-card" key={thread.id}>
                      <div className="admin-dm-meta">
                        <div>
                          <span>{categoryLabels[thread.category] || categoryLabels.etc}</span>
                          <h2>{thread.viewer.nickname || thread.viewer.channelName}</h2>
                          <p>{thread.viewer.channelId}</p>
                        </div>
                        <em>{thread.status === "answered" ? TEXT.answered : TEXT.waiting}</em>
                      </div>

                      <div className="admin-dm-summary">
                        <div><span>{TEXT.firstReceived}</span><strong>{firstMessage ? formatDate(firstMessage.createdAt) : formatDate(thread.createdAt)}</strong></div>
                        <div><span>{TEXT.latestActivity}</span><strong>{formatDate(thread.updatedAt)}</strong></div>
                        {latestReply ? <p>{latestReply.message}</p> : null}
                      </div>

                      <div className="admin-message-list">
                        {thread.messages.map((message) => {
                          const isAdminMessage = message.sender === "admin";
                          const isEditing = editingMessageId === message.id;
                          return (
                            <div className={`admin-message ${message.sender}`} key={message.id}>
                              <div className="admin-message-head">
                                <strong>{isAdminMessage ? TEXT.admin : TEXT.viewer}</strong>
                                {isAdminMessage && !isEditing ? <button type="button" onClick={() => startEdit(message)}>{TEXT.edit}</button> : null}
                              </div>
                              {isEditing ? (
                                <div className="admin-edit-reply">
                                  <textarea value={editDrafts[message.id] || ""} onChange={(event) => setEditDrafts((drafts) => ({ ...drafts, [message.id]: event.target.value }))} rows={3} />
                                  <div>
                                    <button type="button" onClick={() => submitEditReply(thread.id, message.id)}>{TEXT.editSave}</button>
                                    <button type="button" className="secondary" onClick={() => setEditingMessageId("")}>{TEXT.cancel}</button>
                                  </div>
                                </div>
                              ) : (
                                <p>{message.message}</p>
                              )}
                              <small>{formatDate(message.createdAt)}</small>
                            </div>
                          );
                        })}
                      </div>

                      <div className="admin-reply-box">
                        <textarea value={replyDrafts[thread.id] || ""} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [thread.id]: event.target.value }))} placeholder={TEXT.replyPlaceholder} rows={3} />
                        <button type="button" onClick={() => submitReply(thread.id)}>{TEXT.replySave}</button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )) : (
              <div className="admin-empty">{activeDate === "all" ? TEXT.empty : TEXT.selectedEmpty}</div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
