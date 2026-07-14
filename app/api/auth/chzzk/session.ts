export type ChzzkViewerSession = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};

const VIEWER_COOKIE = "chzzk_viewer";
const MAX_AGE = 60 * 60 * 24 * 30;

function getSecret() {
  return process.env.SESSION_SECRET || "firstandsecond-local-session-secret";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodePayload(value: ChzzkViewerSession) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePayload(value: string): ChzzkViewerSession | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(value));
    const parsed = JSON.parse(json) as Partial<ChzzkViewerSession>;
    if (!parsed.channelId || !parsed.channelName || !parsed.nickname || !parsed.verifiedAt) return null;
    return {
      channelId: parsed.channelId,
      channelName: parsed.channelName,
      nickname: parsed.nickname,
      verifiedAt: parsed.verifiedAt,
    };
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verify(value: string, signature: string) {
  return (await sign(value)) === signature;
}

function cookieAttrs(requestUrl: string, maxAge: number) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createViewerCookie(viewer: ChzzkViewerSession, requestUrl: string) {
  const payload = encodePayload(viewer);
  const signature = await sign(payload);
  return `${VIEWER_COOKIE}=${payload}.${signature}; ${cookieAttrs(requestUrl, MAX_AGE)}`;
}

export function clearViewerCookie(requestUrl: string) {
  return `${VIEWER_COOKIE}=; ${cookieAttrs(requestUrl, 0)}`;
}

export async function readViewerSession(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VIEWER_COOKIE}=`));
  if (!cookie) return null;

  const value = decodeURIComponent(cookie.slice(VIEWER_COOKIE.length + 1));
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !(await verify(payload, signature))) return null;
  return decodePayload(payload);
}
