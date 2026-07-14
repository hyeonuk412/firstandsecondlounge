const CHANNEL_ID = "48070f8882233efa7aee52519fee8fca";
const LIVE_DETAIL_URL = `https://api.chzzk.naver.com/service/v2/channels/${CHANNEL_ID}/live-detail`;
const CACHE_MS = 30000;
const FETCH_TIMEOUT_MS = 1500;

type LiveStatusPayload = {
  live: boolean;
  title?: string | null;
  viewerCount?: number | null;
  category?: string | null;
  thumbnailUrl?: string | null;
  openDate?: string | null;
  checkedAt: string;
};

type ChzzkLiveDetail = {
  code?: number;
  content?: {
    liveId?: number | string;
    liveTitle?: string | null;
    status?: string | null;
    concurrentUserCount?: number | null;
    liveCategory?: string | null;
    liveCategoryValue?: string | null;
    openDate?: string | null;
    liveImageUrl?: string | null;
    defaultThumbnailImageUrl?: string | null;
  } | null;
};

declare global {
  var __firstAndSecondLiveStatusCache: { expiresAt: number; payload: LiveStatusPayload } | undefined;
}

function thumbnailUrl(value?: string | null) {
  if (!value) return null;
  return value.replace(/\{type\}/g, "1080");
}

function isLive(content: NonNullable<ChzzkLiveDetail["content"]>) {
  const status = String(content.status || "").toUpperCase();
  if (["CLOSE", "CLOSED", "ENDED", "FINISH", "NONE"].includes(status)) return false;
  return Boolean(content.liveId || status === "OPEN" || status === "LIVE" || status === "ONAIR" || status === "ON_AIR");
}

function offlinePayload(): LiveStatusPayload {
  return { live: false, checkedAt: new Date().toISOString() };
}

async function fetchLiveStatus(): Promise<LiveStatusPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(LIVE_DETAIL_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) return offlinePayload();

    const payload = (await response.json()) as ChzzkLiveDetail;
    const content = payload.content;
    const live = Boolean(content && isLive(content));

    return {
      live,
      title: live ? content?.liveTitle || null : null,
      viewerCount: live ? content?.concurrentUserCount ?? null : null,
      category: live ? content?.liveCategoryValue || content?.liveCategory || null : null,
      thumbnailUrl: live ? thumbnailUrl(content?.liveImageUrl || content?.defaultThumbnailImageUrl) : null,
      openDate: live ? content?.openDate || null : null,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return offlinePayload();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const now = Date.now();
  const cached = globalThis.__firstAndSecondLiveStatusCache;
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
    });
  }

  const payload = await fetchLiveStatus();
  globalThis.__firstAndSecondLiveStatusCache = { expiresAt: now + CACHE_MS, payload };

  return Response.json(payload, {
    headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
  });
}