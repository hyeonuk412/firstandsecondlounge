"use client";

import { useMemo, useState } from "react";
import type { ScheduleItem } from "./api/lounge-content/store";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function monthKey(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
}
function moveMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  return monthKey(new Date(year, m - 1 + offset, 1));
}
function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return `${year}년 ${m}월`;
}
function calendarCells(month: string) {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(year, m - 1, 1);
  const last = new Date(year, m, 0);
  const cells: Array<{ key: string; day?: number; date?: string }> = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push({ key: "b" + i });
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = `${month}-${pad(day)}`;
    cells.push({ key: date, day, date });
  }
  while (cells.length % 7 !== 0) cells.push({ key: "t" + cells.length });
  return cells;
}

function weekdayOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
}

// A schedule matches a calendar date by its explicit date, or — if it only
// has a weekday (recurring) — by matching that weekday.
function matchesDate(s: ScheduleItem, dateStr: string) {
  if (s.date) return s.date === dateStr;
  if (s.day) return s.day === weekdayOf(dateStr);
  return false;
}

type Props = { schedules: ScheduleItem[]; initialMonth: string; today: string };

export default function ScheduleCalendar({ schedules, initialMonth, today }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState(today);

  const cells = useMemo(() => calendarCells(month), [month]);

  const itemsOn = (dateStr: string) =>
    schedules
      .filter((s) => matchesDate(s, dateStr))
      .slice()
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const selectedItems = itemsOn(selected);

  return (
    <div className="cc-cal">
      <div className="cc-cal-head">
        <button type="button" className="cc-cal-nav" onClick={() => setMonth((m) => moveMonth(m, -1))} aria-label="이전 달">‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className="cc-cal-nav" onClick={() => setMonth((m) => moveMonth(m, 1))} aria-label="다음 달">›</button>
      </div>

      <div className="cc-cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d} className={d === "일" ? "sun" : d === "토" ? "sat" : ""}>{d}</span>
        ))}
      </div>

      <div className="cc-cal-grid">
        {cells.map((cell) => {
          if (!cell.date) return <span className="cc-cal-blank" key={cell.key} />;
          const count = itemsOn(cell.date).length;
          const classes = ["cc-cal-day"];
          if (cell.date === selected) classes.push("selected");
          if (cell.date === today) classes.push("today");
          if (count) classes.push("has");
          return (
            <button type="button" className={classes.join(" ")} onClick={() => setSelected(cell.date!)} key={cell.key}>
              <b>{cell.day}</b>
              {count ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <div className="cc-cal-detail">
        <p className="cc-cal-date">{monthLabel(selected.slice(0, 7))} {Number(selected.slice(8))}일</p>
        {selectedItems.length ? (
          <ul className="cc-cal-list">
            {selectedItems.map((s) => (
              <li key={s.id}>
                <span className="cc-cal-time">{s.time || "시간 미정"}</span>
                <strong>{s.title || "방송"}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cc-cal-empty">이 날은 예정된 일정이 없어요 🌙</p>
        )}
      </div>
    </div>
  );
}
