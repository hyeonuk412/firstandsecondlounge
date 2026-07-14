"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Viewer = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};

type DmMessage = {
  id: string;
  sender: "viewer" | "admin";
  message: string;
  createdAt: string;
};

type DmThread = {
  id: string;
  category: string;
  status: "waiting" | "answered";
  createdAt: string;
  updatedAt: string;
  messages: DmMessage[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function latestMessage(thread: DmThread) {
  return thread.messages[thread.messages.length - 1];
}

function firstViewerMessage(thread: DmThread) {
  return thread.messages.find((message) => message.sender === "viewer")?.message || "새 DM";
}

function shortText(value: string, maxLength = 56) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export default function DmPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [loadingDms, setLoadingDms] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadViewer() {
      try {
        const response = await fetch("/api/auth/chzzk/me", { cache: "no-store" });
        const payload = (await response.json()) as { authenticated?: boolean; viewer?: Viewer | null };
        if (!cancelled) setViewer(payload.authenticated ? payload.viewer ?? null : null);
      } catch {
        if (!cancelled) setViewer(null);
      } finally {
        if (!cancelled) setLoadingViewer(false);
      }
    }

    loadViewer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewer) {
      setThreads([]);
      setSelectedThreadId("");
      return;
    }

    loadDmThreads();
    const timer = window.setInterval(() => {
      loadDmThreads({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [viewer]);

  async function loadDmThreads(options?: { silent?: boolean }) {
    if (!options?.silent) setLoadingDms(true);
    if (!options?.silent) setError("");
    try {
      const response = await fetch("/api/dms/my", { cache: "no-store" });
      if (!response.ok) throw new Error("DM을 불러오지 못했어요.");
      const payload = (await response.json()) as { threads: DmThread[] };
      setThreads(payload.threads);
      setSelectedThreadId((current) => {
        if (current && payload.threads.some((thread) => thread.id === current)) return current;
        return payload.threads[0]?.id || "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "DM을 불러오지 못했어요.");
    } finally {
      if (!options?.silent) setLoadingDms(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer || sending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") || "").trim();
    if (!message) return;

    setSending(true);
    setSent(false);
    setError("");
    try {
      const response = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error("DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      const payload = (await response.json()) as { thread: DmThread };
      setThreads((current) => [payload.thread, ...current.filter((thread) => thread.id !== payload.thread.id)]);
      setSelectedThreadId(payload.thread.id);
      setIsComposing(false);
      setSent(true);
      form.reset();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  async function handleAppend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer || !selectedThread || sending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") || "").trim();
    if (!message) return;

    setSending(true);
    setSent(false);
    setError("");
    try {
      const response = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedThread.id, message }),
      });
      if (!response.ok) throw new Error("DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      const payload = (await response.json()) as { thread: DmThread };
      setThreads((current) => [payload.thread, ...current.filter((thread) => thread.id !== payload.thread.id)]);
      setSelectedThreadId(payload.thread.id);
      setSent(true);
      form.reset();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  function startCompose() {
    setIsComposing(true);
    setSelectedThreadId("");
    setSent(false);
    setError("");
  }

  function openThread(threadId: string) {
    setIsComposing(false);
    setSelectedThreadId(threadId);
    setSent(false);
    setError("");
  }

  if (loadingViewer) {
    return (
      <main className="dm-page">
        <section className="dm-login-screen">
          <p className="kicker">DIRECT MESSAGE</p>
          <h1>로그인 상태를 확인하고 있어요.</h1>
        </section>
      </main>
    );
  }

  if (!viewer) {
    return (
      <main className="dm-page">
        <header className="dm-page-header">
          <a className="dm-home-link" href="/">첫째와둘째 팬 라운지</a>
        </header>
        <section className="dm-login-screen">
          <p className="kicker">DIRECT MESSAGE</p>
          <h1>DM은 로그인 후 보낼 수 있어요.</h1>
          <p>치지직으로 로그인하면 닉네임이 자동으로 연동되고, 보낸 DM과 답변을 같은 계정 기준으로 확인할 수 있어요.</p>
          <a className="dm-login-cta" href="/api/auth/chzzk/start">치지직으로 로그인</a>
        </section>
      </main>
    );
  }

  return (
    <main className="dm-page">
      <header className="dm-page-header">
        <a className="dm-home-link" href="/">첫째와둘째 팬 라운지</a>
        <div className="dm-header-user">
          <span>{viewer.nickname || viewer.channelName}님</span>
          <a href="/api/auth/chzzk/logout">로그아웃</a>
        </div>
      </header>

      <section className="dm-layout" aria-label="내 DM함">
        <aside className="dm-sidebar">
          <div className="dm-sidebar-head">
            <div>
              <p className="kicker">DIRECT MESSAGE</p>
              <h1>내 DM</h1>
            </div>
            <button type="button" onClick={startCompose}>새 DM</button>
          </div>

          <div className="dm-thread-list-panel">
            {loadingDms ? (
              <div className="dm-thread-placeholder">DM을 불러오고 있어요.</div>
            ) : threads.length > 0 ? (
              threads.map((thread) => {
                const latest = latestMessage(thread);
                const active = selectedThreadId === thread.id;
                return (
                  <button className={`dm-thread-card ${active ? "active" : ""}`} type="button" onClick={() => openThread(thread.id)} key={thread.id}>
                    <span className="dm-thread-avatar">DM</span>
                    <span className="dm-thread-summary">
                      <strong>{shortText(firstViewerMessage(thread), 34)}</strong>
                      <small>{latest ? shortText(latest.message) : "메시지가 없어요."}</small>
                    </span>
                    <span className="dm-thread-meta">
                      <time>{formatDate(thread.updatedAt)}</time>
                      <em>{thread.status === "answered" ? "답변" : "대기"}</em>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="dm-thread-placeholder">비어 있음</div>
            )}
          </div>
        </aside>

        <section className="dm-chat-panel">
          {isComposing ? (
            <div className="dm-compose-view">
              <div className="dm-chat-head">
                <div>
                  <span>새 스레드</span>
                  <h2>새 DM 보내기</h2>
                </div>
              </div>
              <form className="dm-new-form" onSubmit={handleCreate}>
                <label>
                  DM 내용
                  <textarea name="message" placeholder="첫째와둘째에게 전하고 싶은 내용을 적어주세요." rows={8} required />
                </label>
                <button type="submit" disabled={sending}>{sending ? "보내는 중" : "DM 보내기"}</button>
              </form>
            </div>
          ) : selectedThread ? (
            <>
              <div className="dm-chat-head">
                <div>
                  <h2>{shortText(firstViewerMessage(selectedThread), 42)}</h2>
                </div>
                <em>{selectedThread.status === "answered" ? "답변 완료" : "답변 대기"}</em>
              </div>

              <div className="dm-message-list" aria-label="DM 대화 내용">
                {selectedThread.messages.map((message) => (
                  <article className={`dm-message-row ${message.sender === "viewer" ? "mine" : "theirs"}`} key={message.id}>
                    <div className="dm-message-bubble">
                      <strong>{message.sender === "viewer" ? viewer.nickname || viewer.channelName : "첫째와둘째"}</strong>
                      <p>{message.message}</p>
                      <time>{formatDate(message.createdAt)}</time>
                    </div>
                  </article>
                ))}
              </div>

              <form className="dm-chat-input" onSubmit={handleAppend}>
                <textarea name="message" placeholder="이 스레드에 이어서 DM 보내기" rows={2} required />
                <button type="submit" disabled={sending}>{sending ? "전송 중" : "보내기"}</button>
              </form>
            </>
          ) : (
            <div className="dm-empty-chat compact">
              <button type="button" onClick={startCompose}>새 DM 보내기</button>
            </div>
          )}

          {sent ? <p className="dm-page-sent">DM을 발송했어요.</p> : null}
          {error ? <p className="dm-page-error">{error}</p> : null}
        </section>
      </section>
    </main>
  );
}

