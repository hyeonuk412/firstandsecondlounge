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

  return (
    <main className="lounge-page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="첫째와둘째 팬 라운지 홈">
          <img src="/logo.png" alt="" width="44" height="44" decoding="async" />
          <span>
            <b>첫째와둘째</b>
            <small>팬 라운지</small>
          </span>
        </a>

        <div className="top-auth">
          <HomeAuth adminNicknames={adminNicknames} />
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-main notice-hero">
          <div className="notice-hero-head">
            <a href="/notices" aria-label="공지 목록 보기">
              <p className="kicker">NOTICE</p>
              <h1>공지</h1>
            </a>
            <a className="notice-more" href="/notices">전체보기</a>
          </div>
          <div className="notice-hero-list">
            {notices.slice().sort(byNewestNotice).slice(0, 3).map((notice) => (
              <a href={`/notices/${encodeURIComponent(notice.id || notice.title)}`} key={notice.id || notice.title}>
                <strong>{notice.title}</strong>
                <time>{formatNoticeDate(notice.date)}</time>
              </a>
            ))}
            {!notices.length ? <p className="home-empty-line">등록된 공지가 없어요.</p> : null}
          </div>
        </div>

        <LiveStatusCard />
      </section>

      <section className="quick-grid icon-links" aria-label="빠른 이동">
        {[
          { label: "치지직 LIVE", href: CHZZK_LIVE, tone: "chzzk", icon: CHZZK_ICON },
          { label: "유튜브", href: YOUTUBE, tone: "youtube", icon: YOUTUBE_ICON },
          { label: "DM", href: "/dm", tone: "dm", icon: MESSENGER_ICON },
          { label: "디스코드", href: discordUrl || "#", tone: "discord", icon: DISCORD_ICON },
        ].map((link) => (
          <a className={`quick-card ${link.tone}`} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined} aria-label={link.label} title={link.label} key={link.label}>
            <span className="quick-icon" aria-hidden="true"><img src={link.icon} alt="" width="62" height="62" loading="lazy" decoding="async" /></span>
            <span className="visually-hidden">{link.label}</span>
          </a>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel schedule" id="schedule">
          <div className="panel-head">
            <p className="kicker">SCHEDULE</p>
            <h2>이번 주</h2>
          </div>
          <div className="schedule-list">
            {schedules.map((item) => (
              <article key={`${item.date || item.day}-${item.time}-${item.title}`}>
                <b>{scheduleLabel(item)}</b>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
            {!schedules.length ? <p className="home-empty-line">등록된 스케줄이 없어요.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}