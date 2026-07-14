import { getLoungeContent } from "../api/lounge-content/store";
import ScheduleCalendar from "../ScheduleCalendar";

export const revalidate = 10;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function SchedulePage() {
  const content = await getLoungeContent();
  const schedules = Array.isArray(content.schedules) ? content.schedules : [];

  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const initialMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

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
