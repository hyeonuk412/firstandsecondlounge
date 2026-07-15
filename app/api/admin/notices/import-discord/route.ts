import { requireAdmin } from "../../auth";
import { getLoungeContent } from "../../../lounge-content/store";
import { fetchDiscordNotices } from "../../../discord/notices";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { channelId?: string; limit?: number } = {};
  try {
    body = (await request.json()) as { channelId?: string; limit?: number };
  } catch {
    // empty body is fine; fall back to the saved channel id
  }

  const content = await getLoungeContent();
  const channelId = String(body.channelId || content.settings?.discordNoticeChannelId || "").trim();

  const result = await fetchDiscordNotices(channelId, body.limit || 30);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ notices: result.notices });
}
