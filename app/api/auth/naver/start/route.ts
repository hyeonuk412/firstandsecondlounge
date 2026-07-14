const STATE_COOKIE = "naver_oauth_state";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(name: string, value: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

export async function GET(request: Request) {
  let clientId: string;
  let callbackUrl: string;
  try {
    clientId = getEnv("NAVER_CLIENT_ID");
    callbackUrl = getEnv("NAVER_CALLBACK_URL");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Missing configuration" },
      { status: 500 },
    );
  }

  const state = randomState();
  const authorizeUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({ Location: authorizeUrl.toString() });
  headers.append("Set-Cookie", cookieValue(STATE_COOKIE, state, request.url));

  return new Response(null, { status: 302, headers });
}
