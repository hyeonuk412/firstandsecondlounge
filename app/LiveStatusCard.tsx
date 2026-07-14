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

  return (
    <aside className={`status-card ${liveStatus?.live ? "is-live" : ""}`} aria-label="broadcast status">
      <span className={`status-pill ${liveStatus?.live ? "live" : ""}`}>ON AIR</span>
      <strong>{liveStatus?.live ? liveStatus.title || "라이브 방송 중" : "지금은 방송중이 아니에요."}</strong>
      {liveStatus?.live ? (
        <div className="live-meta">
          <span>{liveStatus.category ? `[${liveStatus.category}] 방송중!` : "방송중!"}</span>
        </div>
      ) : null}
      <a href={CHZZK_LIVE} target="_blank" rel="noreferrer">{liveStatus?.live ? "지금 라이브 보러가기" : "치지직 LIVE 열기"}</a>
    </aside>
  );
}