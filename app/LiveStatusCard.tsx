"use client";

import { useEffect, useState } from "react";

const CHZZK_LIVE = "https://chzzk.naver.com/live/48070f8882233efa7aee52519fee8fca";

type LiveStatus = {
  live: boolean;
  title?: string | null;
  viewerCount?: number | null;
  category?: string | null;
  thumbnailUrl?: string | null;
  openDate?: string | null;
};

export default function LiveStatusCard() {
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveStatus() {
      try {
        const response = await fetch("/api/live-status");
        if (!response.ok) return;
        const payload = (await response.json()) as LiveStatus;
        if (!cancelled) setLiveStatus(payload);
      } catch {
        if (!cancelled) setLiveStatus({ live: false });
      }
    }

    const timer = window.setTimeout(loadLiveStatus, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const live = !!liveStatus?.live;

  return (
    <aside className={`cc-live ${live ? "is-live" : ""}`} aria-label="방송 상태">
      <span className="cc-live-pill">
        <span className="cc-live-dot" aria-hidden="true" />
        {live ? "지금 방송 중!" : "방송 준비 중"}
      </span>
      <strong className="cc-live-title">
        {live ? liveStatus?.title || "라이브 방송 중이에요!" : "지금은 방송 준비 중이에요 😴"}
      </strong>
      {live && liveStatus?.category ? (
        <span className="cc-live-cat">[{liveStatus.category}]</span>
      ) : null}
      <a className="cc-live-btn" href={CHZZK_LIVE} target="_blank" rel="noreferrer">
        {live ? "보러 가기 →" : "치지직 열기 →"}
      </a>
    </aside>
  );
}