import Link from "next/link";
import { getLoungeContent, type NoticeItem } from "../api/lounge-content/store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function noticeDate(value?: string) {
  if (!value) return "날짜 미정";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function byNewest(a: NoticeItem, b: NoticeItem) {
  return (b.date || "").localeCompare(a.date || "");
}

export default async function NoticesPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const content = getLoungeContent();
  const notices = content.notices.slice().sort(byNewest);
  const requestedPage = Number(params?.page || "1");
  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const visibleNotices = notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="notice-page">
      <header className="notice-page-header">
        <div>
          <p className="kicker">NOTICE</p>
          <h1>공지</h1>
          <p>첫째와둘째 팬 라운지 공지 목록입니다.</p>
        </div>
        <Link className="notice-back" href="/">라운지로</Link>
      </header>

      <section className="notice-list-page" aria-label="공지 목록">
        {visibleNotices.map((notice) => (
          <Link href={`/notices/${encodeURIComponent(notice.id)}`} key={notice.id}>
            <strong>{notice.title}</strong>
            <time>{noticeDate(notice.date)}</time>
          </Link>
        ))}
      </section>

      <nav className="notice-pager" aria-label="공지 페이지 이동">
        {page > 1 ? <Link href={`/notices?page=${page - 1}`}>이전</Link> : <span>이전</span>}
        <span>{page} / {totalPages}</span>
        {page < totalPages ? <Link href={`/notices?page=${page + 1}`}>다음</Link> : <span>다음</span>}
      </nav>
    </main>
  );
}
