"use client";

import { useEffect, useState } from "react";

const CHZZK_CHANNEL = "https://chzzk.naver.com/48070f8882233efa7aee52519fee8fca";
const CHZZK_LIVE = "https://chzzk.naver.com/live/48070f8882233efa7aee52519fee8fca";
const YOUTUBE = "https://www.youtube.com/@_brother-siste";
const CHZZK_ICON = "/icons/chzzk.png";
const YOUTUBE_ICON = "https://cdn.simpleicons.org/youtube/FF0000";
const MESSENGER_ICON = "https://cdn.simpleicons.org/messenger/0084FF";
const DISCORD_ICON = "https://cdn.simpleicons.org/discord/5865F2";

type Viewer = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};


type NoticeItem = {
  id?: string;
  tag: string;
  title: string;
  body: string;
  date?: string;
};

type ScheduleItem = {
  id?: string;
  day: string;
  time: string;
  title: string;
};

type LinkSettings = {
  discordUrl: string;
};

type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
  links?: LinkSettings;
};

type LiveStatus = {
  live: boolean;
  title?: string | null;
  viewerCount?: number | null;
  category?: string | null;
  thumbnailUrl?: string | null;
  openDate?: string | null;
};


const DEFAULT_LINKS: LinkSettings = {
  discordUrl: "",
};


const DEFAULT_NOTICES: NoticeItem[] = [
  { id: "notice-open", tag: "공지", title: "팬 라운지 오픈", body: "방송 링크와 DM 창구를 먼저 열어두었어요.", date: "2026-07-14" },
  { id: "notice-login", tag: "DM", title: "치지직 로그인 필요", body: "DM과 답변함은 치지직 계정 기준으로 연결됩니다.", date: "2026-07-14" },
  { id: "notice-schedule", tag: "일정", title: "방송 일정 준비 중", body: "확정되는 일정부터 이곳에 업데이트합니다.", date: "2026-07-14" },
];

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { day: "화", time: "20:00", title: "소통 방송" },
  { day: "목", time: "20:00", title: "게임 방송" },
  { day: "토", time: "21:00", title: "팬 참여 방송" },
];

function formatNoticeDate(value?: string) {
  if (!value) return "날짜 미정";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}


export default function Home() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);
  const [notices, setNotices] = useState<NoticeItem[]>(DEFAULT_NOTICES);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_SCHEDULES);
  const [links, setLinks] = useState<LinkSettings>(DEFAULT_LINKS);
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
        setLinks(payload.links || DEFAULT_LINKS);
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

        <div className="top-auth">
          {loadingViewer ? (
            <span className="top-auth-note">로그인 확인 중</span>
          ) : viewer ? (
            <>
              <div className="top-viewer">
                <span>치지직 로그인</span>
                <strong>{viewer.nickname || viewer.channelName}</strong>
              </div>
              <a className="top-logout" href="/api/auth/chzzk/logout">로그아웃</a>
            </>
          ) : (
            <>
              <div className="top-auth-copy">
                <span>로그인하면 치지직 닉네임이 자동으로 연동됩니다</span>
              </div>
              <a className="top-login-button" href="/api/auth/chzzk/start">치지직으로 로그인</a>
            </>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-main notice-hero">
          <div className="notice-hero-head">
            <a href="/notices" aria-label="공지 목록 보기">
              <p className="kicker">NOTICE</p>
              <h1>공지</h1>
            </a>
            <a className="notice-more" href="/notices">전체보기</a>
          </div>
          <div className="notice-hero-list">
            {notices.slice(0, 5).map((notice) => (
              <a href={`/notices/${encodeURIComponent(notice.id || notice.title)}`} key={notice.id || notice.title}>
                <strong>{notice.title}</strong>
                <time>{formatNoticeDate(notice.date)}</time>
              </a>
            ))}
          </div>
        </div>

        <aside className={`status-card ${liveStatus?.live ? "is-live" : ""}`} aria-label="broadcast status">
          <span className={`status-pill ${liveStatus?.live ? "live" : ""}`}>ON AIR</span>
          <strong>{liveStatus?.live ? liveStatus.title || "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC911" : "\uC9C0\uAE08\uC740 \uBC29\uC1A1\uC911\uC774 \uC544\uB2C8\uC5D0\uC694."}</strong>
          {liveStatus?.live ? (
            <div className="live-meta">
              <span>{liveStatus.category ? `[${liveStatus.category}] \uBC29\uC1A1\uC911!` : "\uBC29\uC1A1\uC911!"}</span>
            </div>
          ) : null}
          <a href={CHZZK_LIVE} target="_blank" rel="noreferrer">{liveStatus?.live ? "\uC9C0\uAE08 \uB77C\uC774\uBE0C \uBCF4\uB7EC\uAC00\uAE30" : "\uCE58\uC9C0\uC9C1 LIVE \uC5F4\uAE30"}</a>
        </aside>
      </section>

      <section className="quick-grid icon-links" aria-label="빠른 이동">
        {[
          { label: "치지직 LIVE", href: CHZZK_LIVE, tone: "chzzk", icon: CHZZK_ICON },
          { label: "유튜브", href: YOUTUBE, tone: "youtube", icon: YOUTUBE_ICON },
          { label: "DM", href: "/dm", tone: "dm", icon: MESSENGER_ICON },
          { label: "디스코드", href: links.discordUrl || "#", tone: "discord", icon: DISCORD_ICON },
        ].map((link) => (
          <a className={`quick-card ${link.tone}`} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined} aria-label={link.label} title={link.label} key={link.label}>
            <span className="quick-icon" aria-hidden="true"><img src={link.icon} alt="" /></span>
            <span className="visually-hidden">{link.label}</span>
          </a>
        ))}
      </section>

      <section className="content-grid">
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

    </main>
  );
}
