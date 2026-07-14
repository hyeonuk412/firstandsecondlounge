import { notFound } from "next/navigation";
import { getLoungeContent } from "../../api/lounge-content/store";

export const revalidate = 10;


export async function generateStaticParams() {
  const content = await getLoungeContent();
  return content.notices.map((notice) => ({ id: notice.id }));
}
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

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = await getLoungeContent();
  const notice = content.notices.find((item) => item.id === decodeURIComponent(id));
  if (!notice) notFound();

  return (
    <main className="cc-page cc-notice-detail">
      <header className="cc-page-head">
        <a className="cc-back" href="/notices">← 목록으로</a>
      </header>

      <article className="cc-detail-card">
        <time className="cc-detail-date">📅 {noticeDate(notice.date)}</time>
        <h1 className="cc-detail-title">{notice.title}</h1>
        <div className="cc-detail-body">{notice.body}</div>
      </article>
    </main>
  );
}
