import { getLoungeContent } from "../api/lounge-content/store";
import ScheduleCalendar from "../ScheduleCalendar";

export const revalidate = 10;

// Compute "today" in Korea time (KST) so it doesn't lag a day on a UTC server.
function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function SchedulePage() {
  const content = await getLoungeContent();
  const schedules = Array.isArray(content.schedules) ? content.schedules : [];

  const today = todayInSeoul();
  const initialMonth = today.slice(0, 7);

  return (
    <main className="cc-page cc-schedule-page">
      <header className="cc-page-head">
        <a className="cc-back" href="/">← 라운지로</a>
        <h1 className="cc-page-title"><span aria-hidden="true">🗓️</span> 방송 일정</h1>
      </header>

      <section className="cc-card cc-cal-card">
        <ScheduleCalendar schedules={schedules} initialMonth={initialMonth} today={today} />
      </section>
    </main>
  );
}
