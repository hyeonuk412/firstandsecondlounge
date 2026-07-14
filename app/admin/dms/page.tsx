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
  title: "DM 관리",
  desc: "들어온 DM을 스레드별로 확인하고 바로 답변합니다.",
  contentLink: "공지 / 스케줄",
  logout: "관리자 로그아웃",
  adminCode: "관리자 코드",
  adminPlaceholder: "관리자 코드를 입력하세요",
  login: "DM 확인하기",
  wrongCode: "관리자 코드가 맞지 않아요.",
  loadError: "DM 목록을 불러오지 못했어요.",
  saveError: "답변을 저장하지 못했어요.",
  editError: "답변을 수정하지 못했어요.",
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

const categoryLabels: Record<string, string> = {
  support: "응원",
  question: "문의",
  suggestion: "제안",
  business: "제휴",
  etc: "기타",
};

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

export default function AdminDmsPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editingMessageId, setEditingMessageId] = useState("");

  const filteredThreads = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return threads;
    return threads.filter((thread) => {
      const viewerName = `${thread.viewer.nickname} ${thread.viewer.channelName} ${thread.viewer.channelId}`.toLowerCase();
      const messages = thread.messages.map((message) => message.message).join(" ").toLowerCase();
      return viewerName.includes(keyword) || messages.includes(keyword) || (categoryLabels[thread.category] || "").includes(keyword);
    });
  }, [query, threads]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

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
      const sortedThreads = sortThreads(payload.threads);
      setThreads(sortedThreads);
      setSelectedThreadId((current) => {
        if (current && sortedThreads.some((thread) => thread.id === current)) return current;
        return sortedThreads[0]?.id || "";
      });
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
    setSelectedThreadId("");
    setQuery("");
    setError("");
  }

  function openThread(threadId: string) {
    setSelectedThreadId(threadId);
    setEditingMessageId("");
    setError("");
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
    <main className="admin-page admin-dm-page">
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
        <section className="admin-messenger" aria-label="관리자 DM">
          <aside className="admin-messenger-sidebar">
            <div className="admin-messenger-head">
              <div>
                <p className="kicker">DIRECT MESSAGE</p>
                <h2>{TEXT.totalDm} <span>{threads.length}{TEXT.countSuffix}</span></h2>
              </div>
              <button type="button" onClick={() => loadThreads()} disabled={loading}>{loading ? TEXT.refreshing : TEXT.refresh}</button>
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
                      <span className="admin-thread-topline">
                        <strong>{viewerName}</strong>
                        <time>{formatDate(thread.updatedAt)}</time>
                      </span>
                      <span className="admin-thread-topic">{categoryLabels[thread.category] || categoryLabels.etc} · {shortText(firstMessage?.message || latest?.message || "")}</span>
                      <span className="admin-thread-preview">{latest?.sender === "admin" ? `${TEXT.admin}: ` : ""}{shortText(latest?.message || "")}</span>
                    </span>
                    <em>{thread.status === "answered" ? TEXT.answered : TEXT.waiting}</em>
                  </button>
                );
              }) : (
                <div className="admin-thread-empty">{TEXT.empty}</div>
              )}
            </div>
          </aside>

          <section className="admin-chat-panel">
            {selectedThread ? (
              <>
                <div className="admin-chat-head">
                  <div className="admin-chat-profile">
                    <span className="admin-thread-avatar large">{(selectedThread.viewer.nickname || selectedThread.viewer.channelName || TEXT.viewer).slice(0, 1)}</span>
                    <div>
                      <strong>{selectedThread.viewer.nickname || selectedThread.viewer.channelName}</strong>
                      <span>{categoryLabels[selectedThread.category] || categoryLabels.etc} · {selectedThread.viewer.channelId}</span>
                    </div>
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
                              <div>
                                <button type="button" onClick={() => submitEditReply(selectedThread.id, message.id)}>{TEXT.editSave}</button>
                                <button type="button" className="secondary" onClick={() => setEditingMessageId("")}>{TEXT.cancel}</button>
                              </div>
                            </div>
                          ) : (
                            <p>{message.message}</p>
                          )}
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
            ) : (
              <div className="admin-chat-empty">{TEXT.noSelection}</div>
            )}

            {error ? <p className="admin-chat-error">{error}</p> : null}
          </section>
        </section>
      )}
    </main>
  );
}
