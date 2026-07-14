import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readViewerSession } from "../api/auth/chzzk/session";
import { getLoungeContent } from "../api/lounge-content/store";
import CheotdoolAdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

const DEFAULT_ADMIN_NICKNAMES = ["첫째와둘째", "첫째입니다", "오늘의메뉴"];

async function readViewerFromCookies() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  return readViewerSession(new Request("https://fnslounge.vercel.app/cheotdooladmin", {
    headers: { cookie: cookieHeader },
  }));
}

export default async function CheotdoolAdminPage() {
  const viewer = await readViewerFromCookies();
  if (!viewer) redirect("/api/auth/chzzk/start");

  const content = await getLoungeContent();
  const nicknames = content.settings?.adminNicknames?.length ? content.settings.adminNicknames : DEFAULT_ADMIN_NICKNAMES;
  const admins = new Set(nicknames);
  const isAdmin = admins.has(viewer.nickname) || admins.has(viewer.channelName);

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <header className="admin-header">
          <div>
            <p className="kicker">FIRST & SECOND ADMIN</p>
            <h1>관리자 권한이 필요해요.</h1>
            <p>현재 치지직 계정은 관리자 닉네임 목록에 없어요.</p>
          </div>
          <div className="admin-header-actions">
            <Link href="/">라운지로</Link>
            <Link href="/api/auth/chzzk/logout">로그아웃</Link>
          </div>
        </header>
      </main>
    );
  }

  return <CheotdoolAdminClient />;
}
