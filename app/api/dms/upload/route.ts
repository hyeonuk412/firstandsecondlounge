import { put } from "@vercel/blob";
import { readViewerSession } from "../../auth/chzzk/session";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf)$/i;

export async function POST(request: Request) {
  const viewer = await readViewerSession(request);
  if (!viewer) {
    return Response.json({ error: "CHZZK login is required" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "파일이 너무 커요 (최대 8MB)" }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_TYPE.test(type)) {
    return Response.json({ error: "이미지 또는 PDF만 첨부할 수 있어요" }, { status: 415 });
  }

  const safeName = (file.name || "file").replace(/[^\w.\-가-힣]+/g, "_").slice(0, 80) || "file";
  const key = `dm/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  try {
    const blob = await put(key, file, { access: "public", contentType: type });
    return Response.json({ url: blob.url, name: file.name || safeName, type });
  } catch {
    return Response.json({ error: "업로드에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
