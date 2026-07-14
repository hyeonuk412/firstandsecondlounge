"use client";

import { FormEvent, useEffect, useState } from "react";

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

export default function AdminDmsPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  async function loadThreads(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dms", {
        cache: "no-store",
        headers: { "x-admin-token": nextToken },
      });
      if (!response.ok) throw new Error(response.status === 401 ? "관리자 코드가 맞지 않아요." : "DM 목록을 불러오지 못했어요.");
      const payload = (await response.json()) as { threads: DmThread[] };
      setThreads(payload.threads);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "DM 목록을 불러오지 못했어요.");
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
      setError("답변을 저장하지 못했어요.");
      return;
    }

    const payload = (await response.json()) as { thread: DmThread };
    setThreads((items) => items.map((item) => item.id === threadId ? payload.thread : item));
    setReplyDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="kicker">FIRST & SECOND ADMIN</p>
          <h1>DM 관리</h1>
          <p>팬 라운지에서 들어온 DM을 확인하고 답변합니다.</p>
        </div>
        {token ? <button type="button" onClick={handleLogout}>관리자 로그아웃</button> : null}
      </header>

      {!token ? (
        <form className="admin-login" onSubmit={handleLogin}>
          <label>
            관리자 코드
            <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="관리자 코드를 입력하세요" />
          </label>
          <button type="submit">DM 확인하기</button>
          {error ? <p className="dm-error">{error}</p> : null}
        </form>
      ) : (
        <section className="admin-dm-shell">
          <div className="admin-toolbar">
            <strong>전체 DM {threads.length}개</strong>
            <button type="button" onClick={() => loadThreads()} disabled={loading}>{loading ? "새로고침 중" : "새로고침"}</button>
          </div>
          {error ? <p className="dm-error">{error}</p> : null}

          <div className="admin-dm-list">
            {threads.length > 0 ? threads.map((thread) => (
              <article className="admin-dm-card" key={thread.id}>
                <div className="admin-dm-meta">
                  <div>
                    <span>{categoryLabels[thread.category] || "기타"}</span>
                    <h2>{thread.viewer.nickname || thread.viewer.channelName}</h2>
                    <p>{thread.viewer.channelId}</p>
                  </div>
                  <em>{thread.status === "answered" ? "답변 완료" : "답변 대기"}</em>
                </div>

                <div className="admin-message-list">
                  {thread.messages.map((message) => (
                    <div className={`admin-message ${message.sender}`} key={message.id}>
                      <strong>{message.sender === "admin" ? "관리자" : "시청자"}</strong>
                      <p>{message.message}</p>
                      <small>{formatDate(message.createdAt)}</small>
                    </div>
                  ))}
                </div>

                <div className="admin-reply-box">
                  <textarea value={replyDrafts[thread.id] || ""} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [thread.id]: event.target.value }))} placeholder="답변을 입력하세요" rows={3} />
                  <button type="button" onClick={() => submitReply(thread.id)}>답변 저장</button>
                </div>
              </article>
            )) : (
              <div className="admin-empty">아직 들어온 DM이 없어요.</div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
