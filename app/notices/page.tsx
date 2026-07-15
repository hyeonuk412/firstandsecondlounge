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
    <main className="cc-page cc-notices">
      <header className="cc-page-head">
        <a className="cc-back" href="/">← 라운지로</a>
        <h1 className="cc-page-title"><span aria-hidden="true">📢</span> 공지</h1>
      </header>

      <section className="cc-notice-page-list" aria-label="공지 목록">
        {notices.map((notice, i) => (
          <a className="cc-notice-card" href={`/notices/${encodeURIComponent(notice.id)}`} key={notice.id}>
            <span className="cc-notice-num">{i + 1}</span>
            <span className="cc-notice-copy">
              <strong>{notice.title}</strong>
              <time>{noticeDate(notice.date)}</time>
            </span>
            <span className="cc-notice-go" aria-hidden="true">→</span>
          </a>
        ))}
        {!notices.length ? <p className="cc-empty">아직 공지가 없어요 🍃</p> : null}
      </section>
    </main>
  );
}