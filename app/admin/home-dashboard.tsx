"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, DollarSign, Mail, MessageSquare, Pencil, UsersRound, X } from "lucide-react";
import { datePlus, serviceName, todaySydney, type Lang } from "@/lib/catalog";
import { adminInboxEvent, readAdminInbox } from "@/lib/admin-email";
import { getRosterAvailability } from "@/lib/admin-roster";
import { useRosterShifts } from "@/lib/use-admin-roster";
import type { WorkshopComment } from "@/lib/comments-contract";
import type { FinancialSummary } from "@/lib/workshop-financials";
import type { CalendarEntry } from "./workshop-tools";
import "./home-dashboard.css";

const widgetOptions = {
  email: { en: "Email", zh: "邮件", href: "/admin/email", icon: Mail },
  financials: { en: "Monthly financials", zh: "月度财务", href: "/admin/settings/financials", icon: DollarSign },
  appointments: { en: "Appointments", zh: "预约", href: "/admin/appointments", icon: CalendarDays },
  roster: { en: "Roster", zh: "员工排班", href: "/admin/roster", icon: UsersRound },
  reviews: { en: "Recent reviews", zh: "最近评价", href: "/admin/settings#reviews", icon: MessageSquare },
} as const;

const widgetSizes = { small: 2, medium: 3, large: 5 } as const;
type WidgetId = keyof typeof widgetOptions;
type WidgetSize = keyof typeof widgetSizes;
type Widget = { id: WidgetId; size: WidgetSize };

const layoutKey = "harbour-admin-home-layout-v1";
const defaultWidgets: Widget[] = [
  { id: "email", size: "small" }, { id: "financials", size: "medium" }, { id: "appointments", size: "large" },
];

function readLayout(): Widget[] {
  try {
    const layout: unknown = JSON.parse(localStorage.getItem(layoutKey) ?? "null");
    if (!Array.isArray(layout)) return defaultWidgets;
    const result: Widget[] = [];
    for (const value of layout) {
      if (!value || !Object.hasOwn(widgetOptions, value.id) || !Object.hasOwn(widgetSizes, value.size)) continue;
      if (!result.some(widget => widget.id === value.id)) result.push({ id: value.id, size: value.size });
    }
    return result.length ? result : defaultWidgets;
  } catch {
    return defaultWidgets;
  }
}

function dateLabel(date: string, lang: Lang, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-AU", { ...options, timeZone: "Australia/Sydney" })
    .format(new Date(date + "T12:00:00Z"));
}

async function dashboardRead<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("UNAVAILABLE");
  return response.json() as Promise<T>;
}

type DashboardData = {
  week?: CalendarEntry[] | null;
  finances?: FinancialSummary | null;
  reviews?: WorkshopComment[] | null;
  inbox?: { unread: number; important: number; total: number };
};

function AppointmentPreview({ today, week, lang }: { today: string; week?: CalendarEntry[] | null; lang: Lang }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const active = (week ?? []).filter(entry => ["confirmed", "requested"].includes(entry.status));
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
  const upcoming = active.filter(entry => entry.date > today || (entry.date === today && entry.time >= currentTime));
  const confirmed = upcoming.filter(entry => entry.status === "confirmed").length;
  const requested = upcoming.length - confirmed;
  const days = Array.from({ length: 7 }, (_, index) => datePlus(today, index));

  return <>
    <div className="home-widget-stat">
      <strong>{week ? upcoming.length : "—"}</strong>
      <span>{t("未来七天预约", "Over the next 7 days")}</span>
    </div>
    {week === null && <p className="home-widget-caption">{t("暂时无法读取预约。", "Appointments unavailable.")}</p>}
    {week && <>
      <div className="home-appointment-legend">
        <span><i />{confirmed} {t("已确认", "confirmed")}</span>
        <span><i />{requested} {t("待确认", "requested")}</span>
      </div>
      <div className="home-appointment-week" aria-label={t("未来七天预约", "Appointments over the next seven days")}>
        {days.map(day => {
          const visits = active.filter(entry => entry.date === day);
          const dayLabel = dateLabel(day, lang, { weekday: "short" });
          const accessibleLabel = t(dayLabel + "，" + visits.length + " 笔预约", dayLabel + ", " + visits.length + " appointments");
          return <span className={day === today ? "home-week-today" : ""} key={day} aria-label={accessibleLabel}>
            <span>{dayLabel}</span>
            <b>{new Date(day + "T12:00:00Z").getUTCDate()}</b>
            <span className="home-week-dots" aria-hidden="true">
              {visits.slice(0, 3).map(entry => <i key={entry.id} data-requested={entry.status === "requested"} />)}
            </span>
          </span>;
        })}
      </div>
      <ul className="home-appointment-list">
        {upcoming.slice(0, 2).map(entry => <li key={entry.id}>
          <strong>{entry.time}</strong>
          <span>{serviceName(entry.service, lang)}</span>
          <span>{dateLabel(entry.date, lang, { weekday: "short", day: "numeric" })}</span>
        </li>)}
      </ul>
    </>}
  </>;
}

export function HomeDashboard({ lang }: { lang: Lang }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const [today] = useState(todaySydney);
  const [layout, setLayout] = useState<Widget[]>(defaultWidgets);
  const [draft, setDraft] = useState<Widget[]>(defaultWidgets);
  const [data, setData] = useState<DashboardData>({});
  const [savedMessage, setSavedMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const { shifts, loading: rosterLoading, error: rosterError } = useRosterShifts(today);
  const roster = getRosterAvailability(shifts, today);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLayout(readLayout()));
    const controller = new AbortController();
    const { signal } = controller;
    const week = dashboardRead<{ bookings: CalendarEntry[] }>("/api/workshop?action=adminWeek&start=" + today, signal);
    const finances = dashboardRead<FinancialSummary>("/api/workshop?action=adminFinancials&month=" + today.slice(0, 7), signal);
    const reviews = dashboardRead<{ comments: WorkshopComment[] }>("/api/comments", signal);
    void week.then(result => { if (!signal.aborted) setData(value => ({ ...value, week: result.bookings })); })
      .catch(() => { if (!signal.aborted) setData(value => ({ ...value, week: null })); });
    void finances.then(result => { if (!signal.aborted) setData(value => ({ ...value, finances: result })); })
      .catch(() => { if (!signal.aborted) setData(value => ({ ...value, finances: null })); });
    void reviews.then(result => { if (!signal.aborted) setData(value => ({ ...value, reviews: result.comments })); })
      .catch(() => { if (!signal.aborted) setData(value => ({ ...value, reviews: null })); });
    const refreshInbox = () => {
      const messages = readAdminInbox();
      const unread = messages.filter(message => !message.read);
      setData(value => ({ ...value, inbox: { unread: unread.length, important: unread.filter(message => message.category !== "general").length, total: messages.length } }));
    };
    const inboxFrame = requestAnimationFrame(refreshInbox);
    window.addEventListener(adminInboxEvent, refreshInbox);
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(inboxFrame);
      window.removeEventListener(adminInboxEvent, refreshInbox);
    };
  }, [today]);

  function openEditor() {
    setDraft(layout);
    setSavedMessage("");
    dialog.current?.showModal();
  }

  function saveLayout() {
    setLayout(draft);
    try {
      localStorage.setItem(layoutKey, JSON.stringify(draft));
      setSavedMessage(t("布局已保存。", "Layout saved."));
    } catch {
      setSavedMessage(t("布局已应用。本浏览器无法记住设置。", "Layout applied. This browser could not remember it."));
    }
    dialog.current?.close();
  }

  function shiftWidget(index: number, offset: number) {
    setDraft(items => {
      const next = index + offset;
      const copy = items.slice();
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  function renderData(id: WidgetId): ReactNode {
    if (id === "appointments") return <AppointmentPreview today={today} week={data.week} lang={lang} />;
    if (id === "email") {
      return <><div className="home-widget-stat"><strong>{data.inbox?.unread ?? "—"}</strong><span>{t("未读邮件", "Unread messages")}</span></div>
        <p className="home-widget-caption">{data.inbox?.total ? t(data.inbox.important + " 封待处理", data.inbox.important + " need attention") : t("查看收件箱或导入邮件。", "Open the inbox or import a message.")}</p></>;
    }
    if (id === "financials") {
      const cents = data.finances?.receipts.cents;
      const amount = cents === undefined ? "—" : new Intl.NumberFormat(lang === "zh" ? "zh-AU" : "en-AU", { style: "currency", currency: "AUD", currencyDisplay: "narrowSymbol" }).format(cents / 100);
      return <><div className="home-widget-stat"><strong>{amount}</strong><span>{t("本月已收款", "Received this month")}</span></div>
        <p className="home-widget-caption">{data.finances ? data.finances.receipts.count + " " + t("笔已登记收款", data.finances.receipts.count === 1 ? "recorded receipt" : "recorded receipts") : data.finances === null ? t("暂时无法读取财务数据。", "Financials unavailable.") : t("正在读取财务数据…", "Loading financials…")}</p></>;
    }
    if (id === "roster") {
      return <><div className="home-widget-stat"><strong>{rosterLoading || rosterError ? "—" : roster.length}</strong><span>{t("今日排班员工", "Rostered today")}</span></div>
        <p className="home-widget-caption">{rosterError ? t("暂时无法读取排班。", "Roster unavailable.") : roster.length ? roster.map(member => member.name).join(" · ") : t("查看本周排班。", "Open the weekly roster.")}</p></>;
    }
    const review = data.reviews?.[0];
    return <><div className="home-widget-stat home-review-stat"><strong>{review?.name || (review ? t("访客", "Guest") : "—")}</strong></div>
      <p className="home-widget-caption">{review?.message || (data.reviews ? t("暂无评价。", "No recent reviews.") : data.reviews === null ? t("暂时无法读取评价。", "Reviews unavailable.") : t("正在读取评价…", "Loading reviews…"))}</p></>;
  }

  const split = Math.ceil(layout.length / 2);
  const columns = [layout.slice(0, split), layout.slice(split)].filter(column => column.length);
  const gridColumns = columns.map(column => "minmax(0," + Math.max(...column.map(widget => widgetSizes[widget.size])) + "fr)").join(" ");
  const sizeLabels: Record<WidgetSize, string> = { small: t("小", "Small"), medium: t("中", "Medium"), large: t("大", "Large") };

  return <div className="admin-home-dashboard">
    <header className="home-dashboard-header">
      <div>
        <h1>{t("主页", "Home")}</h1>
        <button type="button" className="home-layout-button" onClick={openEditor}><Pencil size={15} aria-hidden="true" />{t("编辑布局", "Edit layout")}</button>
        {savedMessage && <span className="home-layout-status" role="status">{savedMessage}</span>}
      </div>
      <p className="home-dashboard-date"><CalendarDays size={17} aria-hidden="true" /><time dateTime={today}>{dateLabel(today, lang, { dateStyle: "full" })}</time></p>
    </header>

    <div className="home-widget-board" style={{ gridTemplateColumns: gridColumns }}>
      {columns.map((column, index) => <div className="home-widget-column" key={index} style={{ gridTemplateRows: column.map(widget => "minmax(0," + widgetSizes[widget.size] + "fr)").join(" ") }}>
        {column.map(({ id, size }) => {
          const { icon: Icon, href } = widgetOptions[id];
          const title = widgetOptions[id][lang];
          const path = id === "appointments" ? href + "?date=" + today : href;
          return <a className={"home-widget home-widget-" + id} data-size={size} key={id} href={path} aria-label={t("打开", "Open ") + title}>
            <div className="home-widget-heading"><span className="home-widget-icon"><Icon size={19} aria-hidden="true" /></span><h2>{title}</h2><span className="home-widget-arrow"><ArrowRight size={17} aria-hidden="true" /></span></div>
            <div className="home-widget-content">{renderData(id)}</div>
          </a>;
        })}
      </div>)}
    </div>

    <dialog ref={dialog} className="home-layout-dialog" aria-labelledby="layout-title">
      <div className="home-dialog-heading"><h2 id="layout-title">{t("编辑主页布局", "Edit homepage layout")}</h2><button type="button" className="home-icon-button" aria-label={t("关闭", "Close")} onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <p>{t("添加、排序或调整组件大小。", "Add, reorder or resize your widgets.")}</p>
      <ol className="home-layout-options">
        {draft.map(({ id, size }, index) => <li key={id}>
          <strong>{widgetOptions[id][lang]}</strong>
          <select aria-label={widgetOptions[id][lang] + t("大小", " size")} value={size} onChange={event => setDraft(items => items.map(widget => widget.id === id ? { ...widget, size: event.target.value as WidgetSize } : widget))}>
            {(Object.keys(widgetSizes) as WidgetSize[]).map(option => <option key={option} value={option}>{sizeLabels[option]}</option>)}
          </select>
          <div className="home-widget-order">
            <button type="button" className="home-icon-button" disabled={index === 0} onClick={() => shiftWidget(index, -1)} aria-label={t("上移", "Move up ") + widgetOptions[id][lang]}><ArrowUp size={17} /></button>
            <button type="button" className="home-icon-button" disabled={index === draft.length - 1} onClick={() => shiftWidget(index, 1)} aria-label={t("下移", "Move down ") + widgetOptions[id][lang]}><ArrowDown size={17} /></button>
            <button type="button" className="home-icon-button" disabled={draft.length === 1} onClick={() => setDraft(items => items.filter(widget => widget.id !== id))} aria-label={t("移除", "Remove ") + widgetOptions[id][lang]}><X size={17} /></button>
          </div>
        </li>)}
      </ol>
      <div className="home-add-widgets">
        {(Object.keys(widgetOptions) as WidgetId[]).filter(id => !draft.some(widget => widget.id === id)).map(id => <button className="home-layout-button" type="button" key={id} onClick={() => setDraft(items => [...items, { id, size: "medium" }])}>+ {widgetOptions[id][lang]}</button>)}
      </div>
      <div className="home-dialog-actions"><button type="button" className="home-layout-button" onClick={() => setDraft(defaultWidgets)}>{t("恢复默认", "Restore default")}</button><button type="button" className="home-save-button" onClick={saveLayout}>{t("保存布局", "Save layout")}</button></div>
    </dialog>
  </div>;
}
