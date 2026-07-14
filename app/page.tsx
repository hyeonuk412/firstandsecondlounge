import { getLoungeContent, type NoticeItem, type ScheduleItem } from "./api/lounge-content/store";
import HomeAuth from "./HomeAuth";
import LiveStatusCard from "./LiveStatusCard";

const CHZZK_LIVE = "https://chzzk.naver.com/live/48070f8882233efa7aee52519fee8fca";
const YOUTUBE = "https://www.youtube.com/@_brother-siste";
const CHZZK_ICON = "/icons/chzzk.png";
const YOUTUBE_ICON = "/icons/youtube.svg";
const MESSENGER_ICON = "/icons/messenger.svg";
const DISCORD_ICON = "/icons/discord.svg";
const DEFAULT_ADMIN_NICKNAMES = ["첫째와둘째", "첫째입니다", "오늘의메뉴"];

export const revalidate = 10;

function formatNoticeDate(value?: string) {
  if (!value) return "날짜 미정";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function byNewestNotice(a: NoticeItem, b: NoticeItem) {
  return (b.date || "").localeCompare(a.date || "");
}

function scheduleLabel(item: ScheduleItem) {
  if (!item.date) return item.day;
  const date = new Date(item.date + "T00:00:00");
  if (Number.isNaN(date.getTime())) return item.date;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export default async function Home() {
  const content = await getLoungeContent();
  const notices = Array.isArray(content.notices) ? content.notices : [];
  const schedules = Array.isArray(content.schedules) ? content.schedules : [];
  const discordUrl = content.settings?.discordUrl || content.links?.discordUrl || "";
  const adminNicknames = content.settings?.adminNicknames?.length ? content.settings.adminNicknames : DEFAULT_ADMIN_NICKNAMES;

  const links = [
    { label: "치지직 LIVE", href: CHZZK_LIVE, tone: "chzzk", icon: CHZZK_ICON, emoji: "📺" },
    { label: "유튜브", href: YOUTUBE, tone: "youtube", icon: YOUTUBE_ICON, emoji: "▶️" },
    { label: "쪽지 DM", href: "/dm", tone: "dm", icon: MESSENGER_ICON, emoji: "💌" },
    { label: "디스코드", href: discordUrl || "#", tone: "discord", icon: DISCORD_ICON, emoji: "💬" },
  ];

  const topNotices = notices.slice().sort(byNewestNotice).slice(0, 3);

  return (
    <main className="cc-home" id="top">
      <div className="cc-blob cc-blob-a" aria-hidden="true" />
      <div className="cc-blob cc-blob-b" aria-hidden="true" />

      <header className="cc-top">
        <a className="cc-brand" href="#top" aria-label="첫째와둘째 팬 라운지 홈">
          <span className="cc-brand-logo">
            <img src="/logo.png" alt="" width="48" height="48" decoding="async" />
          </span>
          <span className="cc-brand-name">
            <b>첫째와둘째</b>
            <em>팬 라운지</em>
          </span>
        </a>
        <div className="cc-auth">
          <HomeAuth adminNicknames={adminNicknames} />
        </div>
      </header>

      <section className="cc-hero">
        <div className="cc-hero-card">
          <p className="cc-hero-kicker">✨ 첫째와둘째 팬 라운지</p>
          <h1 className="cc-hero-title">놀러 와요,<br />우리 라운지!</h1>
          <p className="cc-hero-sub">방송 소식부터 쪽지까지, 팬들을 위한 아지트예요 💛</p>
          <div className="cc-hero-tags" aria-hidden="true">
            <span>🐣 첫째</span>
            <span>🐥 둘째</span>
            <span>💚 치지직</span>
          </div>
        </div>
        <LiveStatusCard />
      </section>

      <section className="cc-links" aria-label="빠른 이동">
        {links.map((link) => (
          <a
            className={`cc-link ${link.tone}`}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noreferrer" : undefined}
            key={link.label}
          >
            <span className="cc-link-icon" aria-hidden="true">
              <img src={link.icon} alt="" width="40" height="40" loading="lazy" decoding="async" />
            </span>
            <span className="cc-link-label">{link.label}</span>
            <span className="cc-link-emoji" aria-hidden="true">{link.emoji}</span>
          </a>
        ))}
      </section>

      <section className="cc-cols">
        <div className="cc-card cc-notice">
          <div className="cc-card-head">
            <h2><span className="cc-emoji" aria-hidden="true">📢</span> 공지</h2>
            <a className="cc-more" href="/notices">전체보기</a>
          </div>
          <div className="cc-notice-list">
            {topNotices.map((notice) => (
              <a
                className="cc-notice-item"
                href={`/notices/${encodeURIComponent(notice.id || notice.title)}`}
                key={notice.id || notice.title}
              >
                <strong>{notice.title}</strong>
                <time>{formatNoticeDate(notice.date)}</time>
              </a>
            ))}
            {!topNotices.length ? (
              <p className="cc-empty">아직 공지가 없어요 🍃</p>
            ) : null}
          </div>
        </div>

        <div className="cc-card cc-schedule" id="schedule">
          <div className="cc-card-head">
            <h2><span className="cc-emoji" aria-hidden="true">🗓️</span> 이번 주</h2>
          </div>
          <div className="cc-schedule-list">
            {schedules.map((item) => (
              <article className="cc-schedule-item" key={`${item.date || item.day}-${item.time}-${item.title}`}>
                <b className="cc-day">{scheduleLabel(item)}</b>
                <span className="cc-time">{item.time}</span>
                <strong className="cc-sched-title">{item.title}</strong>
              </article>
            ))}
            {!schedules.length ? (
              <p className="cc-empty">이번 주 일정은 준비 중이에요 🌱</p>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="cc-foot">
        <span>💛 첫째와둘째 팬 라운지</span>
      </footer>
    </main>
  );
}
