"use client";

import { FormEvent, useEffect, useState } from "react";

const CHZZK_CHANNEL = "https://chzzk.naver.com/48070f8882233efa7aee52519fee8fca";
const CHZZK_LIVE = "https://chzzk.naver.com/live/48070f8882233efa7aee52519fee8fca";
const YOUTUBE = "https://www.youtube.com/@_brother-siste";

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

type NoticeItem = {
  id?: string;
  tag: string;
  title: string;
  body: string;
};

type ScheduleItem = {
  id?: string;
  day: string;
  time: string;
  title: string;
};

type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
};

type LiveStatus = {
  live: boolean;
  title?: string | null;
  viewerCount?: number | null;
  category?: string | null;
  openDate?: string | null;
};

const categoryLabels: Record<string, string> = {
  support: "응원",
  question: "문의",
  suggestion: "제안",
  business: "제휴",
  etc: "기타",
};

const quickLinks = [
  {
    label: "치지직 LIVE",
    title: "방송 보러가기",
    detail: "실시간 방송은 여기서 바로 열어요.",
    href: CHZZK_LIVE,
    tone: "chzzk",
  },
  {
    label: "YouTube",
    title: "다시보기",
    detail: "영상과 클립은 유튜브에서 확인해요.",
    href: YOUTUBE,
    tone: "youtube",
  },
  {
    label: "DM",
    title: "메시지 보내기",
    detail: "치지직 로그인 후 내 DM함에서 보낼 수 있어요.",
    href: "#dm",
    tone: "dm",
  },
];

const DEFAULT_NOTICES: NoticeItem[] = [
  { tag: "공지", title: "팬 라운지 오픈", body: "방송 링크와 DM 창구를 먼저 열어두었어요." },
  { tag: "DM", title: "치지직 로그인 필요", body: "DM과 답변함은 치지직 계정 기준으로 연결됩니다." },
  { tag: "일정", title: "방송 일정 준비 중", body: "확정되는 일정부터 이곳에 업데이트합니다." },
];

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { day: "화", time: "20:00", title: "소통 방송" },
  { day: "목", time: "20:00", title: "게임 방송" },
  { day: "토", time: "21:00", title: "팬 참여 방송" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function firstViewerMessage(thread: DmThread) {
  return thread.messages.find((message) => message.sender === "viewer")?.message || "";
}

function latestAdminReply(thread: DmThread) {
  return thread.messages.filter((message) => message.sender === "admin").at(-1);
}

export default function Home() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);
  const [loadingDms, setLoadingDms] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [notices, setNotices] = useState<NoticeItem[]>(DEFAULT_NOTICES);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_SCHEDULES);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const response = await fetch("/api/lounge-content", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as LoungeContent;
        if (cancelled) return;
        setNotices(payload.notices?.length ? payload.notices : DEFAULT_NOTICES);
        setSchedules(payload.schedules?.length ? payload.schedules : DEFAULT_SCHEDULES);
      } catch {
        // Keep the built-in defaults if the editable content API is unavailable.
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveStatus() {
      try {
        const response = await fetch("/api/live-status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as LiveStatus;
        if (!cancelled) setLiveStatus(payload);
      } catch {
        if (!cancelled) setLiveStatus({ live: false });
      }
    }

    loadLiveStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadDmThreads() {
    setLoadingDms(true);
    try {
      const response = await fetch("/api/dms/my", { cache: "no-store" });
      if (!response.ok) throw new Error("DM을 불러오지 못했어요.");
      const payload = (await response.json()) as { threads: DmThread[] };
      setDmThreads(payload.threads);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "DM을 불러오지 못했어요.");
    } finally {
      setLoadingDms(false);
    }
  }

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
    if (viewer) {
      loadDmThreads();
    } else {
      setDmThreads([]);
      setSelectedThreadId("");
    }
  }, [viewer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const category = String(formData.get("category") || "etc");
    const message = String(formData.get("message") || "").trim();
    if (!message) return;

    setError("");
    setSent(false);
    const response = await fetch("/api/dms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message }),
    });

    if (!response.ok) {
      setError("DM을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const payload = (await response.json()) as { thread: DmThread };
    setDmThreads((threads) => [payload.thread, ...threads]);
    setSelectedThreadId("");
    setSent(true);
    setIsComposing(false);
    form.reset();
  }

  async function handleAppendSubmit(event: FormEvent<HTMLFormElement>, threadId: string) {
    event.preventDefault();
    if (!viewer) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") || "").trim();
    if (!message) return;

    setError("");
    setSent(false);
    const response = await fetch("/api/dms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message }),
    });

    if (!response.ok) {
      setError("DM\uC744 \uBCF4\uB0B4\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
      return;
    }

    const payload = (await response.json()) as { thread: DmThread };
    setDmThreads((threads) => [payload.thread, ...threads.filter((thread) => thread.id !== payload.thread.id)]);
    setSelectedThreadId(payload.thread.id);
    setSent(true);
    form.reset();
  }

  return (
    <main className="lounge-page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="첫째와둘째 팬 라운지 홈">
          <img src="/logo.png" alt="" />
          <span>
            <b>첫째와둘째</b>
            <small>팬 라운지</small>
          </span>
        </a>
        <nav className="topnav" aria-label="주요 링크">
          <a href={CHZZK_CHANNEL} target="_blank" rel="noreferrer">치지직</a>
          <a href={YOUTUBE} target="_blank" rel="noreferrer">유튜브</a>
          <a href="#dm">DM</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-main">
          <p className="kicker">FIRST & SECOND FAN LOUNGE</p>
          <h1>방송 보러오고, 소식 보고, DM 남기는 곳</h1>
          <p className="hero-text">첫째와둘째 팬들을 위한 공식 라운지입니다.</p>
        </div>

        <aside className={`status-card ${liveStatus?.live ? "is-live" : ""}`} aria-label="broadcast status">
          <span className={`status-pill ${liveStatus?.live ? "live" : ""}`}>{liveStatus?.live ? "ON AIR" : "\uB2E4\uC74C \uBC29\uC1A1 \uC900\uBE44 \uC911"}</span>
          <strong>{liveStatus?.live ? liveStatus.title || "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC911" : "\uC624\uB298\uC740 \uACF5\uC9C0\uC640 \uC2A4\uCF00\uC904\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694."}</strong>
          {liveStatus?.live ? (
            <div className="live-meta">
              {liveStatus.category ? <span>{liveStatus.category}</span> : null}
              {typeof liveStatus.viewerCount === "number" ? <span>{liveStatus.viewerCount.toLocaleString("ko-KR")}{"\uBA85 \uC2DC\uCCAD \uC911"}</span> : null}
            </div>
          ) : null}
          <a href={CHZZK_LIVE} target="_blank" rel="noreferrer">{liveStatus?.live ? "\uC9C0\uAE08 \uB77C\uC774\uBE0C \uBCF4\uB7EC\uAC00\uAE30" : "\uCE58\uC9C0\uC9C1 LIVE \uC5F4\uAE30"}</a>
        </aside>
      </section>

      <section className="quick-grid" aria-label="빠른 이동">
        {quickLinks.map((link) => (
          <a className={`quick-card ${link.tone}`} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined} key={link.title}>
            <span>{link.label}</span>
            <strong>{link.title}</strong>
            <small>{link.detail}</small>
          </a>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel notices" id="notice">
          <div className="panel-head">
            <p className="kicker">NOTICE</p>
            <h2>공지</h2>
          </div>
          <div className="notice-list">
            {notices.map((notice) => (
              <article key={notice.title}>
                <span>{notice.tag}</span>
                <div>
                  <h3>{notice.title}</h3>
                  <p>{notice.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel schedule" id="schedule">
          <div className="panel-head">
            <p className="kicker">SCHEDULE</p>
            <h2>이번 주</h2>
          </div>
          <div className="schedule-list">
            {schedules.map((item) => (
              <article key={`${item.day}-${item.title}`}>
                <b>{item.day}</b>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="dm-panel" id="dm" aria-labelledby="dm-title">
        <div className="dm-copy">
          <p className="kicker">DIRECT MESSAGE</p>
          <h2 id="dm-title">내 DM함</h2>
          <p>DM은 치지직 로그인 후 보낼 수 있어요. 답변도 같은 계정 기준으로 확인할 수 있게 준비합니다.</p>
        </div>

        <div className="dm-auth-area">
          {loadingViewer ? (
            <div className="auth-card">
              <strong>로그인 상태를 확인하고 있어요.</strong>
              <p>잠시만 기다려주세요.</p>
            </div>
          ) : viewer ? (
            <div className="dm-compose">
              <div className="viewer-greeting">
                <div>
                  <span>치지직 로그인 완료</span>
                  <h3>{viewer.nickname || viewer.channelName}님 안녕하세요.</h3>
                  <p>이 계정으로 보낸 DM과 답변을 확인할 수 있어요.</p>
                </div>
                <a className="logout-link" href="/api/auth/chzzk/logout">로그아웃</a>
              </div>

              <div className="dm-inbox-head">
                <div>
                  <strong>내 DM</strong>
                  <span>{dmThreads.length}개</span>
                </div>
                <button type="button" onClick={() => { setSent(false); setSelectedThreadId(""); setIsComposing((value) => !value); }}>
                  {isComposing ? "작성 닫기" : "새 DM 보내기"}
                </button>
              </div>

              <div className="dm-thread-list" aria-label="내 DM 목록">
                {loadingDms ? (
                  <div className="dm-empty"><strong>DM을 불러오고 있어요.</strong></div>
                ) : dmThreads.length > 0 ? (
                  dmThreads.map((thread) => {
                    const reply = latestAdminReply(thread);
                    const isSelected = selectedThreadId === thread.id;
                    return (
                      <article className="dm-thread-item" key={thread.id}>
                        <button className={`dm-thread ${isSelected ? "selected" : ""}`} type="button" aria-expanded={isSelected} onClick={() => { setSent(false); setIsComposing(false); setSelectedThreadId(isSelected ? "" : thread.id); }}>
                          <div>
                            <span>{categoryLabels[thread.category] || "\uAE30\uD0C0"}</span>
                            {isSelected ? <strong>{"DM \uB300\uD654"}</strong> : <strong>{firstViewerMessage(thread)}</strong>}
                            {!isSelected && reply ? <p className="dm-reply">{"\uB2F5\uBCC0: "}{reply.message}</p> : null}
                            <small>{thread.messages.length}{"\uAC1C\uC758 \uBA54\uC2DC\uC9C0 / "}{formatDate(thread.updatedAt)}</small>
                          </div>
                          <em>{thread.status === "answered" ? "\uB2F5\uBCC0 \uC644\uB8CC" : "\uB2F5\uBCC0 \uB300\uAE30"}</em>
                        </button>
                        {isSelected ? (
                          <div className="dm-thread-detail">
                            <div className="dm-thread-detail-head">
                              <strong>{"\uB300\uD654 \uB0B4\uC6A9"}</strong>
                            </div>
                            <div className="dm-conversation">
                              {thread.messages.map((message) => (
                                <div className={`dm-bubble ${message.sender}`} key={message.id}>
                                  <strong>{message.sender === "admin" ? "\uAD00\uB9AC\uC790" : viewer.nickname || viewer.channelName}</strong>
                                  <p>{message.message}</p>
                                  <small>{formatDate(message.createdAt)}</small>
                                </div>
                              ))}
                            </div>
                            <form className="dm-append-form" onSubmit={(event) => handleAppendSubmit(event, thread.id)}>
                              <label>
                                {"\uCD94\uAC00 DM"}
                                <textarea name="message" placeholder={"\uC774 DM\uC5D0 \uC774\uC5B4\uC11C \uBCF4\uB0BC \uB0B4\uC6A9\uC744 \uC801\uC5B4\uC8FC\uC138\uC694."} rows={4} required />
                              </label>
                              <button type="submit">{"\uCD94\uAC00\uB85C \uBCF4\uB0B4\uAE30"}</button>
                            </form>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="dm-empty">
                    <strong>아직 보낸 DM이 없어요.</strong>
                    <p>새 DM을 보내면 이곳에서 상태와 답변을 확인할 수 있어요.</p>
                  </div>
                )}
              </div>

              {sent ? <p className="sent">{"DM\uC744 \uBC1C\uC1A1\uD588\uC5B4\uC694."}</p> : null}
              {error ? <p className="dm-error">{error}</p> : null}

              {isComposing ? (
                <form className="dm-form" onSubmit={handleSubmit}>
                  <label>
                    카테고리
                    <select name="category" defaultValue="support">
                      <option value="support">응원</option>
                      <option value="question">문의</option>
                      <option value="suggestion">제안</option>
                      <option value="business">제휴</option>
                      <option value="etc">기타</option>
                    </select>
                  </label>
                  <label className="wide">
                    DM 내용
                    <textarea name="message" placeholder="전하고 싶은 이야기를 적어주세요." rows={6} required />
                  </label>
                  <label className="consent wide">
                    <input type="checkbox" required />
                    <span>DM 확인과 답변을 위해 치지직 채널 정보와 입력한 내용을 운영자가 확인하는 것에 동의합니다.</span>
                  </label>
                  <button type="submit">DM 보내기</button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="auth-card login-required">
              <strong>치지직 로그인 후 DM함을 볼 수 있어요.</strong>
              <p>로그인하면 치지직 닉네임이 자동으로 연결됩니다.</p>
              <a className="chzzk-login-button" href="/api/auth/chzzk/start">치지직으로 로그인</a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
