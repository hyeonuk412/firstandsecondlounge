import { createViewerCookie, clearViewerCookie } from "../session";

type ChzzkTokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: string | number;
  scope?: string;
  code?: number | string;
  message?: string | null;
  content?: {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    expiresIn?: string | number;
    scope?: string;
  };
};

type ChzzkUserPayload = {
  code?: number | string;
  message?: string | null;
  content?: {
    channelId?: string;
    channelName?: string;
    nickname?: string;
    channelImageUrl?: string;
  };
  channelId?: string;
  channelName?: string;
  nickname?: string;
  channelImageUrl?: string;
};

const STATE_COOKIE = "chzzk_oauth_state";
const OPEN_API_BASE = "https://openapi.chzzk.naver.com";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=") || ""));
  }
  return cookies;
}

function clearStateCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function tokenFields(payload: ChzzkTokenResponse) {
  return payload.content ?? payload;
}

function userFields(payload: ChzzkUserPayload) {
  return payload.content ?? payload;
}

function redirectHome(request: Request, headers: Headers) {
  const target = new URL("/", request.url);
  headers.set("Location", target.toString());
  return new Response(null, { status: 302, headers });
}

async function fetchChzzkToken(code: string, state: string) {
  const response = await fetch(`${OPEN_API_BASE}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      clientId: getEnv("CHZZK_CLIENT_ID"),
      clientSecret: getEnv("CHZZK_CLIENT_SECRET"),
      code,
      state,
    }),
  });
  const payload = (await parseResponse(response)) as ChzzkTokenResponse;
  const fields = tokenFields(payload);
  if (!response.ok || !fields.accessToken) {
    throw new Error(payload.message || `Failed to fetch CHZZK token (${response.status})`);
  }
  return payload;
}

async function fetchChzzkUser(accessToken: string) {
  const response = await fetch(`${OPEN_API_BASE}/open/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const payload = (await parseResponse(response)) as ChzzkUserPayload;
  const fields = userFields(payload);
  if (!response.ok || !fields.channelId) {
    throw new Error(payload.message || `Failed to fetch CHZZK user (${response.status})`);
  }
  return payload;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = parseCookies(request.headers.get("cookie")).get(STATE_COOKIE);
  const headers = new Headers();
  headers.append("Set-Cookie", clearStateCookie(request.url));

  if (!code || !state || !savedState || state !== savedState) {
    headers.append("Set-Cookie", clearViewerCookie(request.url));
    return redirectHome(request, headers);
  }

  try {
    const token = await fetchChzzkToken(code, state);
    const tokenData = tokenFields(token);
    const user = await fetchChzzkUser(tokenData.accessToken!);
    const userInfo = userFields(user);
    const channelName = userInfo.channelName || userInfo.nickname || "치지직 사용자";

    headers.append(
      "Set-Cookie",
      await createViewerCookie(
        {
          channelId: userInfo.channelId!,
          channelName,
          nickname: userInfo.nickname || channelName,
          verifiedAt: new Date().toISOString(),
        },
        request.url,
      ),
    );

    return redirectHome(request, headers);
  } catch {
    headers.append("Set-Cookie", clearViewerCookie(request.url));
    return redirectHome(request, headers);
  }
}

