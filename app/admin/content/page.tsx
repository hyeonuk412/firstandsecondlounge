"use client";

import { FormEvent, useEffect, useState } from "react";

type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date: string;
};

type ScheduleItem = {
  id: string;
  day: string;
  time: string;
  title: string;
};

type LinkSettings = {
  discordUrl: string;
};

const DEFAULT_LINKS: LinkSettings = {
  discordUrl: "",
};

type LoungeContent = {
  notices: NoticeItem[];
  schedules: ScheduleItem[];
  links: LinkSettings;
  updatedAt: string;
};

const TEXT = {
  kicker: "FIRST & SECOND ADMIN",
  title: "\uACF5\uC9C0 / \uC2A4\uCF00\uC904 \uAD00\uB9AC",
  desc: "\uD32C \uB77C\uC6B4\uC9C0 \uD648\uC5D0 \uBCF4\uC774\uB294 \uACF5\uC9C0\uC640 \uC8FC\uAC04 \uC2A4\uCF00\uC904\uC744 \uC218\uC815\uD569\uB2C8\uB2E4.",
  logout: "\uAD00\uB9AC\uC790 \uB85C\uADF8\uC544\uC6C3",
  adminCode: "\uAD00\uB9AC\uC790 \uCF54\uB4DC",
  adminPlaceholder: "\uAD00\uB9AC\uC790 \uCF54\uB4DC\uB97C \uC785\uB825\uD558\uC138\uC694",
  login: "\uAD00\uB9AC \uD654\uBA74 \uC5F4\uAE30",
  notices: "\uACF5\uC9C0",
  schedules: "\uC2A4\uCF00\uC904",
  links: "\uB9C1\uD06C",
  discordUrl: "\uB514\uC2A4\uCF54\uB4DC \uC8FC\uC18C",
  addNotice: "\uACF5\uC9C0 \uCD94\uAC00",
  addSchedule: "\uC2A4\uCF00\uC904 \uCD94\uAC00",
  save: "\uC800\uC7A5\uD558\uAE30",
  saving: "\uC800\uC7A5 \uC911",
  saved: "\uC800\uC7A5\uD588\uC5B4\uC694.",
  delete: "\uC0AD\uC81C",
  backToDms: "DM \uAD00\uB9AC\uB85C",
  tag: "\uD0DC\uADF8",
  noticeTitle: "\uC81C\uBAA9",
  noticeBody: "\uB0B4\uC6A9",
  noticeDate: "\uB0A0\uC9DC",
  day: "\uC694\uC77C",
  time: "\uC2DC\uAC04",
  scheduleTitle: "\uC77C\uC815\uBA85",
  wrongCode: "\uAD00\uB9AC\uC790 \uCF54\uB4DC\uAC00 \uB9DE\uC9C0 \uC54A\uC544\uC694.",
  loadError: "\uB0B4\uC6A9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  saveError: "\uB0B4\uC6A9\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
};

function newId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyNotice(): NoticeItem {
  return { id: newId("notice"), tag: "\uACF5\uC9C0", title: "", body: "", date: new Date().toISOString().slice(0, 10) };
}

function emptySchedule(): ScheduleItem {
  return { id: newId("schedule"), day: "", time: "", title: "" };
}

export default function AdminContentPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [links, setLinks] = useState<LinkSettings>(DEFAULT_LINKS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function loadContent(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/content", {
        cache: "no-store",
        headers: { "x-admin-token": nextToken },
      });
      if (!response.ok) throw new Error(response.status === 401 ? TEXT.wrongCode : TEXT.loadError);
      const payload = (await response.json()) as LoungeContent;
      setNotices(payload.notices);
      setSchedules(payload.schedules);
      setLinks(payload.links || DEFAULT_LINKS);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : TEXT.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem("firstandsecond:admin-token") || "";
    if (savedToken) {
      setToken(savedToken);
      setTokenInput(savedToken);
      loadContent(savedToken);
    }
  }, []);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    window.sessionStorage.setItem("firstandsecond:admin-token", nextToken);
    setToken(nextToken);
    loadContent(nextToken);
  }

  function handleLogout() {
    window.sessionStorage.removeItem("firstandsecond:admin-token");
    setToken("");
    setTokenInput("");
    setNotices([]);
    setSchedules([]);
    setLinks(DEFAULT_LINKS);
    setError("");
    setSaved(false);
  }

  async function saveContent() {
    if (!token) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ notices, schedules, links }),
    });

    if (!response.ok) {
      setSaving(false);
      setError(TEXT.saveError);
      return;
    }

    const payload = (await response.json()) as LoungeContent;
    setNotices(payload.notices);
    setSchedules(payload.schedules);
    setLinks(payload.links || DEFAULT_LINKS);
    setSaving(false);
    setSaved(true);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="kicker">{TEXT.kicker}</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.desc}</p>
        </div>
        <div className="admin-header-actions">
          <a href="/admin/dms">{TEXT.backToDms}</a>
          {token ? <button type="button" onClick={handleLogout}>{TEXT.logout}</button> : null}
        </div>
      </header>

      {!token ? (
        <form className="admin-login" onSubmit={handleLogin}>
          <label>
            {TEXT.adminCode}
            <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder={TEXT.adminPlaceholder} />
          </label>
          <button type="submit">{TEXT.login}</button>
          {error ? <p className="dm-error">{error}</p> : null}
        </form>
      ) : (
        <section className="admin-dm-shell admin-content-shell">
          <div className="admin-toolbar">
            <strong>{loading ? "Loading" : TEXT.title}</strong>
            <button type="button" onClick={saveContent} disabled={saving}>{saving ? TEXT.saving : TEXT.save}</button>
          </div>
          {saved ? <p className="sent">{TEXT.saved}</p> : null}
          {error ? <p className="dm-error">{error}</p> : null}

          <div className="admin-content-grid">
            <section className="admin-content-section">
              <div className="admin-section-head">
                <h2>{TEXT.links}</h2>
              </div>
              <article className="admin-edit-card">
                <label>{TEXT.discordUrl}<input value={links.discordUrl} onChange={(event) => setLinks({ ...links, discordUrl: event.target.value })} placeholder="https://discord.gg/..." /></label>
              </article>
            </section>

            <section className="admin-content-section">
              <div className="admin-section-head">
                <h2>{TEXT.notices}</h2>
                <button type="button" onClick={() => setNotices((items) => [...items, emptyNotice()])}>{TEXT.addNotice}</button>
              </div>
              <div className="admin-edit-list">
                {notices.map((notice, index) => (
                  <article className="admin-edit-card" key={notice.id}>
                    <div className="admin-edit-row notice-row">
                      <label>{TEXT.tag}<input value={notice.tag} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, tag: event.target.value } : item))} /></label>
                      <label>{TEXT.noticeTitle}<input value={notice.title} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                      <label>{TEXT.noticeDate}<input type="date" value={notice.date || ""} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value } : item))} /></label>
                    </div>
                    <label>{TEXT.noticeBody}<textarea rows={4} value={notice.body} onChange={(event) => setNotices((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} /></label>
                    <button className="admin-danger" type="button" onClick={() => setNotices((items) => items.filter((_, itemIndex) => itemIndex !== index))}>{TEXT.delete}</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-content-section">
              <div className="admin-section-head">
                <h2>{TEXT.schedules}</h2>
                <button type="button" onClick={() => setSchedules((items) => [...items, emptySchedule()])}>{TEXT.addSchedule}</button>
              </div>
              <div className="admin-edit-list">
                {schedules.map((schedule, index) => (
                  <article className="admin-edit-card" key={schedule.id}>
                    <div className="admin-edit-row schedule-row">
                      <label>{TEXT.day}<input value={schedule.day} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value } : item))} /></label>
                      <label>{TEXT.time}<input value={schedule.time} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, time: event.target.value } : item))} /></label>
                      <label>{TEXT.scheduleTitle}<input value={schedule.title} onChange={(event) => setSchedules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                    </div>
                    <button className="admin-danger" type="button" onClick={() => setSchedules((items) => items.filter((_, itemIndex) => itemIndex !== index))}>{TEXT.delete}</button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
