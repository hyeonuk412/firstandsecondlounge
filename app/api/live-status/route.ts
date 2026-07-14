const CHANNEL_ID = "48070f8882233efa7aee52519fee8fca";
const LIVE_DETAIL_URL = `https://api.chzzk.naver.com/service/v2/channels/${CHANNEL_ID}/live-detail`;

export const dynamic = "force-dynamic";

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

function isLive(content: NonNullable<ChzzkLiveDetail["content"]>) {
  const status = String(content.status || "").toUpperCase();
  if (["CLOSE", "CLOSED", "ENDED", "FINISH", "NONE"].includes(status)) return false;
  return Boolean(content.liveId || status === "OPEN" || status === "LIVE" || status === "ONAIR" || status === "ON_AIR");
}

export async function GET() {
  try {
    const response = await fetch(LIVE_DETAIL_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return Response.json({ live: false, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
    }

    const payload = (await response.json()) as ChzzkLiveDetail;
    const content = payload.content;
    const live = Boolean(content && isLive(content));

    return Response.json({
      live,
      title: live ? content?.liveTitle || null : null,
      viewerCount: live ? content?.concurrentUserCount ?? null : null,
      category: live ? content?.liveCategoryValue || content?.liveCategory || null : null,
      thumbnailUrl: live ? content?.liveImageUrl || content?.defaultThumbnailImageUrl || null : null,
      openDate: live ? content?.openDate || null : null,
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ live: false, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  }
}
