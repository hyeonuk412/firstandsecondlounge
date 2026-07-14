"use client";

import { useEffect, useState } from "react";

type Viewer = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};

type HomeAuthProps = {
  adminNicknames: string[];
};

function isAdminViewer(viewer: Viewer, adminNicknames: string[]) {
  const admins = new Set(adminNicknames);
  return admins.has(viewer.nickname) || admins.has(viewer.channelName);
}

export default function HomeAuth({ adminNicknames }: HomeAuthProps) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);

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

  if (loadingViewer) {
    return <span className="top-auth-note">로그인 확인 중</span>;
  }

  if (viewer) {
    return (
      <>
        <div className="top-viewer">
          <span>치지직 로그인</span>
          <strong>{viewer.nickname || viewer.channelName}</strong>
        </div>
        {isAdminViewer(viewer, adminNicknames) ? <a className="top-admin-link" href="/cheotdooladmin">관리자 페이지</a> : null}
        <a className="top-logout" href="/api/auth/chzzk/logout">로그아웃</a>
      </>
    );
  }

  return (
    <>
      <div className="top-auth-copy">
        <span>로그인하면 치지직 닉네임이 자동으로 연동됩니다</span>
      </div>
      <a className="top-login-button" href="/api/auth/chzzk/start">치지직으로 로그인</a>
    </>
  );
}