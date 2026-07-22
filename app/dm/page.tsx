"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import PushToggle from "../PushToggle";

type Viewer = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};

type DmAttachment = { url: string; name: string; type: string };

type DmMessage = {
  id: string;
  sender: "viewer" | "admin";
  message: string;
  createdAt: string;
  attachment?: DmAttachment;
};

type UploadResult = { ok: true; attachment: DmAttachment } | { ok: false; error: string };

async function uploadAttachment(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/dms/upload", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as Partial<DmAttachment> & { error?: string };
  if (!response.ok || !data.url) {
    return { ok: false, error: data.error || "첨부 파일을 올리지 못했어요." };
  }
  return { ok: true, attachment: { url: data.url, name: data.name || file.name, type: data.type || file.type } };
}

function AttachmentView({ attachment }: { attachment: DmAttachment }) {
  const isImage = attachment.type.startsWith("image/");
  if (isImage) {
    return (
      <a className="dm-attach" href={attachment.url} target="_blank" rel="noreferrer">
        <img src={attachment.url} alt={attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="dm-attach-file" href={attachment.url} target="_blank" rel="noreferrer">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg> {attachment.name}
    </a>
  );
}

type DmTarget = "first" | "second" | "both";

type DmThread = {
  id: string;
  category: string;
  target: DmTarget;
  status: "waiting" | "answered";
  createdAt: string;
  updatedAt: string;
  messages: DmMessage[];
};

const TARGET_OPTIONS: { value: DmTarget; label: string }[] = [
  { value: "first", label: "첫째" },
  { value: "second", label: "둘째" },
  { value: "both", label: "첫째와둘째" },
];

function targetLabel(target: DmTarget) {
  return TARGET_OPTIONS.find((option) => option.value === target)?.label || "첫째와둘째";
}

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
  const [error, setError] = useState("");
  const [target, setTarget] = useState<DmTarget>("both");

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const messageListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedThreadId, selectedThread?.messages.length]);

  const [newAttachName, setNewAttachName] = useState("");
  const [replyAttachName, setReplyAttachName] = useState("");

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
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!message && !hasFile) return;

    setSending(true);
    setError("");
    try {
      let attachment: DmAttachment | null = null;
      if (hasFile) {
        const result = await uploadAttachment(file);
        if (!result.ok) throw new Error(result.error);
        attachment = result.attachment;
      }
      const response = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachment, target }),
      });
      if (!response.ok) throw new Error("DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      const payload = (await response.json()) as { thread: DmThread };
      setThreads((current) => [payload.thread, ...current.filter((thread) => thread.id !== payload.thread.id)]);
      setSelectedThreadId(payload.thread.id);
      setIsComposing(false);
      form.reset();
      setNewAttachName("");
      setTarget("both");
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
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!message && !hasFile) return;

    const threadId = selectedThread.id;
    setSending(true);
    setError("");
    try {
      let attachment: DmAttachment | null = null;
      if (hasFile) {
        const result = await uploadAttachment(file);
        if (!result.ok) throw new Error(result.error);
        attachment = result.attachment;
      }
      // optimistic: show the message immediately, clear the input
      const tempId = `temp-${Date.now()}`;
      const tempMessage: DmMessage = { id: tempId, sender: "viewer", message, createdAt: new Date().toISOString(), ...(attachment ? { attachment } : {}) };
      setThreads((current) => current.map((thread) => (thread.id === threadId
        ? { ...thread, status: "waiting", updatedAt: tempMessage.createdAt, messages: [...thread.messages, tempMessage] }
        : thread)));
      form.reset();
      setReplyAttachName("");

      const response = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message, attachment }),
      });
      if (!response.ok) throw new Error("DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      const payload = (await response.json()) as { thread: DmThread };
      setThreads((current) => [payload.thread, ...current.filter((thread) => thread.id !== payload.thread.id)]);
      setSelectedThreadId(payload.thread.id);
    } catch (sendError) {
      // rollback the optimistic message
      setThreads((current) => current.map((thread) => (thread.id === threadId
        ? { ...thread, messages: thread.messages.filter((item) => !item.id.startsWith("temp-")) }
        : thread)));
      setError(sendError instanceof Error ? sendError.message : "DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  function submitTextareaOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function startCompose() {
    setIsComposing(true);
    setSelectedThreadId("");
    setError("");
  }

  function openThread(threadId: string) {
    setIsComposing(false);
    setSelectedThreadId(threadId);
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
          <p>치지직 로그인하면 닉네임이 자동으로 연동되고, 닉네임을 제외한 정보는 수집하지 않아요.</p>
          <a className="dm-login-cta" href="/api/auth/chzzk/start?next=/dm">치지직으로 로그인</a>
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
          <PushToggle />
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
                      <b className="dm-thread-to">{targetLabel(thread.target)}</b>
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
                <div className="dm-target-field">
                  <span className="dm-target-label">받는 사람</span>
                  <div className="dm-target-group" role="group" aria-label="받는 사람 선택">
                    {TARGET_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`dm-target-chip ${target === option.value ? "active" : ""}`}
                        onClick={() => setTarget(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  DM 내용
                  <textarea name="message" placeholder={`${targetLabel(target)}에게 전하고 싶은 내용을 적어주세요.`} rows={8} onKeyDown={submitTextareaOnEnter} />
                </label>
                <label className="dm-attach-btn">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg> {newAttachName || "사진·파일 첨부 (이미지·PDF, 8MB)"}
                  <input type="file" name="file" accept="image/*,application/pdf" hidden onChange={(event) => setNewAttachName(event.target.files?.[0]?.name || "")} />
                </label>
                <button type="submit" disabled={sending}>{sending ? "보내는 중" : "DM 보내기"}</button>
              </form>
            </div>
          ) : selectedThread ? (
            <>
              <div className="dm-chat-head">
                <div>
                  <h2>{shortText(firstViewerMessage(selectedThread), 42)}</h2>
                  <span className="dm-chat-target">받는 사람 · {targetLabel(selectedThread.target)}</span>
                </div>
                <em>{selectedThread.status === "answered" ? "답변 완료" : "답변 대기"}</em>
              </div>

              <div className="dm-message-list" aria-label="DM 대화 내용" ref={messageListRef}>
                {selectedThread.messages.map((message) => (
                  <article className={`dm-message-row ${message.sender === "viewer" ? "mine" : "theirs"}`} key={message.id}>
                    <div className="dm-message-stack">
                      <strong className="dm-message-author">{message.sender === "viewer" ? viewer.nickname || viewer.channelName : "첫째와둘째"}</strong>
                      <div className="dm-message-bubble">
                        {message.message ? <p>{message.message}</p> : null}
                        {message.attachment ? <AttachmentView attachment={message.attachment} /> : null}
                      </div>
                      <time className="dm-message-time">{formatDate(message.createdAt)}</time>
                    </div>
                  </article>
                ))}
              </div>

              <form className="dm-chat-input" onSubmit={handleAppend}>
                {replyAttachName ? <span className="dm-attach-chip"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg> {replyAttachName}</span> : null}
                <label className="dm-attach-icon" title="파일 첨부 (이미지·PDF)">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg>
                  <input type="file" name="file" accept="image/*,application/pdf" hidden onChange={(event) => setReplyAttachName(event.target.files?.[0]?.name || "")} />
                </label>
                <textarea name="message" placeholder="이 스레드에 이어서 DM 보내기" rows={1} onKeyDown={submitTextareaOnEnter} />
                <button className="dm-send-btn" type="submit" disabled={sending} aria-label="보내기">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M2.3 20.3 21.5 12 2.3 3.7 2.3 10.3 15 12 2.3 13.7z" /></svg>
                </button>
              </form>
            </>
          ) : (
            <div className="dm-empty-chat compact">
              <button type="button" onClick={startCompose}>새 DM 보내기</button>
            </div>
          )}
          {error ? <p className="dm-page-error">{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
