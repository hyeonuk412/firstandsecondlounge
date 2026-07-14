type NaverTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
};

type NaverProfileResponse = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    nickname?: string;
    name?: string;
    email?: string;
    profile_image?: string;
  };
};

const STATE_COOKIE = "naver_oauth_state";

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

function clearCookie(name: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyJson(value: unknown) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function htmlPage(body: string, status = 200, headers?: Headers) {
  const responseHeaders = headers ?? new Headers();
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>네이버 로그인 테스트 - 첫째와둘째 팬 라운지</title>
  <style>
    body{margin:0;background:#f8f2e8;color:#241f28;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;line-height:1.55}
    main{width:min(920px,calc(100% - 32px));margin:0 auto;padding:42px 0 70px}
    .card{background:rgba(255,255,255,.82);border:1px solid rgba(36,31,40,.12);border-radius:20px;padding:24px;box-shadow:0 18px 48px rgba(64,52,92,.13);margin-top:16px}
    h1{font-size:32px;margin:0 0 8px} h2{font-size:22px;margin:0 0 12px} p{margin:8px 0;color:#706879;font-weight:700}
    .ok{color:#0f8f82}.fail{color:#e15b38}.badge{display:inline-flex;border-radius:999px;padding:6px 10px;background:#f1efff;color:#6d5dfc;font-weight:800;font-size:13px}
    pre{white-space:pre-wrap;word-break:break-word;background:#241f28;color:#fff;border-radius:14px;padding:14px;overflow:auto;font-size:13px}
    a{display:inline-flex;margin-top:18px;color:#fff;background:#6d5dfc;border-radius:14px;padding:12px 16px;text-decoration:none;font-weight:800}
  </style>
</head>
<body><main>${body}</main></body>
</html>`, { status, headers: responseHeaders });
}

async function fetchNaverToken(code: string, state: string) {
  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", getEnv("NAVER_CLIENT_ID"));
  tokenUrl.searchParams.set("client_secret", getEnv("NAVER_CLIENT_SECRET"));
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const response = await fetch(tokenUrl.toString(), { method: "GET" });
  const payload = (await response.json()) as NaverTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Failed to fetch Naver token");
  }
  return payload;
}

async function fetchNaverProfile(accessToken: string) {
  const response = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json()) as NaverProfileResponse;
  if (!response.ok) throw new Error(payload.message || "Failed to fetch Naver profile");
  return payload;
}

async function testChzzkUserStatus(accessToken: string) {
  const response = await fetch("https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Origin: "https://chzzk.naver.com",
      Referer: "https://chzzk.naver.com/",
      "User-Agent": "Mozilla/5.0 FirstAndSecondFanLounge/1.0",
    },
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    payload,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const savedState = parseCookies(request.headers.get("cookie")).get(STATE_COOKIE);
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE, request.url));

  if (error) {
    return htmlPage(`<h1>네이버 로그인 실패</h1><div class="card"><p class="fail">${escapeHtml(error)}</p><p>${escapeHtml(errorDescription)}</p></div><a href="/">팬 라운지로 돌아가기</a>`, 400, headers);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return htmlPage(`<h1>네이버 로그인 검증 실패</h1><div class="card"><p class="fail">state 값이 맞지 않거나 로그인 정보가 만료됐어요.</p></div><a href="/api/auth/naver/start">다시 테스트하기</a>`, 400, headers);
  }

  try {
    const token = await fetchNaverToken(code, state);
    const profile = await fetchNaverProfile(token.access_token!);
    const chzzk = await testChzzkUserStatus(token.access_token!);
    const profileName = profile.response?.nickname || profile.response?.name || "네이버 사용자";
    const chzzkClass = chzzk.ok ? "ok" : "fail";
    const chzzkLabel = chzzk.ok ? "치지직 상태 조회 성공" : "치지직 상태 조회 실패";

    return htmlPage(`
      <span class="badge">첫째와둘째 팬 라운지</span>
      <h1>네이버 로그인 테스트 결과</h1>
      <p>로그인은 완료됐고, 같은 토큰으로 치지직 사용자 상태 조회가 가능한지 테스트했습니다.</p>

      <section class="card">
        <h2 class="ok">네이버 프로필 조회 성공</h2>
        <p>${escapeHtml(profileName)}님으로 확인됐어요.</p>
        <pre>${prettyJson(profile)}</pre>
      </section>

      <section class="card">
        <h2 class="${chzzkClass}">${chzzkLabel}</h2>
        <p>HTTP ${escapeHtml(chzzk.status)} ${escapeHtml(chzzk.statusText)}</p>
        <pre>${prettyJson(chzzk.payload)}</pre>
      </section>

      <a href="/">팬 라운지로 돌아가기</a>
    `, 200, headers);
  } catch (error) {
    return htmlPage(`<h1>테스트 중 오류</h1><div class="card"><p class="fail">${escapeHtml(error instanceof Error ? error.message : "알 수 없는 오류")}</p></div><a href="/api/auth/naver/start">다시 테스트하기</a>`, 500, headers);
  }
}
