import Link from "next/link";
import { getLoungeContent, type NoticeItem } from "../api/lounge-content/store";

export const revalidate = 10;

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

export default async function NoticesPage() {
  const content = await getLoungeContent();
  const notices = content.notices.slice().sort(byNewest);

  return (
    <main className="notice-page">
      <header className="notice-page-header compact">
        <div>
          <p className="kicker">NOTICE</p>
          <h1>공지</h1>
        </div>
        <a className="notice-back" href="/">라운지로</a>
      </header>

      <section className="notice-list-page" aria-label="공지 목록">
        {notices.map((notice) => (
          <a href={`/notices/${encodeURIComponent(notice.id)}`} key={notice.id}>
            <strong>{notice.title}</strong>
            <time>{noticeDate(notice.date)}</time>
          </a>
        ))}
        {!notices.length ? <p className="home-empty-line">등록된 공지가 없어요.</p> : null}
      </section>
    </main>
  );
}