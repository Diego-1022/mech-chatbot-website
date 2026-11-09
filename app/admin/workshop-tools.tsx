"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import {api, errorText, statusLabel} from "@/lib/client";
import {datePlus, services, serviceName, times, todaySydney, validSlot, type Lang} from "@/lib/catalog";
import {workshopContact} from "@/lib/workshop-info";
import {readWorkshopNotice, type NoticeText} from "@/components/workshop-notice";

export type CalendarEntry = {id:string; date:string; time:string; service:string; status:string};

// Planning defaults for the initial service or inspection, in minutes.
const serviceWorkMinutes: Partial<Record<string, readonly [number, number]>> = {
  service: [60, 90],
  brakes: [30, 60],
  battery: [30, 45],
  diagnostic: [45, 90],
  tyres: [45, 75],
  aircon: [45, 90],
};

function workEstimate(service: string, lang: Lang) {
  const range = Object.hasOwn(serviceWorkMinutes, service) ? serviceWorkMinutes[service] : undefined;
  if (!range) return null;
  const [min, max] = range;
  return lang === "zh" ? `预计工时 ${min}–${max} 分钟` : `Est. work ${min}–${max} min`;
}

export function mondayOf(date: string) {
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  return datePlus(date, -((weekday + 6) % 7));
}

export function WorkshopWeek({date, entries, lang, onDate}: {
  date:string; entries:CalendarEntry[]; lang:Lang; onDate:(date:string)=>void;
}) {
  const start = mondayOf(date);
  const days = Array.from({length:7}, (_, index) => datePlus(start,index));
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const labels = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-AU", {
    weekday:"short", month:"short", day:"numeric", timeZone:"Australia/Sydney",
  });
  return <section className="panel">
    <h2>{t("预约周历","Weekly appointments")}</h2>
    <p className="muted">{t("悉尼接车时段。待确认请求不占用时段。","Sydney check-in slots. Requested visits do not hold a slot.")}</p>
    <p className="small muted">{t("预计工时按服务类型给出，仅供内部安排。实际工时视车型和检查结果而定。", "Work estimates are planning ranges by service. Actual time depends on the vehicle and inspection findings.")}</p>
    <div className="toolbar workshop-week-nav">
      <button className="secondary" onClick={() => onDate(datePlus(start,-7))}>{t("上一周","Previous week")}</button>
      <button className="secondary" onClick={() => onDate(todaySydney())}>{t("本周","This week")}</button>
      <button className="secondary" onClick={() => onDate(datePlus(start,7))}>{t("下一周","Next week")}</button>
    </div>
    <div className="workshop-week-scroll" role="region" aria-label={t("预约周历","Weekly appointments")} tabIndex={0}>
      <div className="workshop-week">
        {days.map(day => <section key={day} className="workshop-day">
          <button className="workshop-day-select" aria-pressed={day===date} onClick={() => onDate(day)}>
            {labels.format(new Date(day+"T00:00:00Z"))}
          </button>
          {times.map(time => {
            const visits=entries.filter(row => row.date===day && row.time===time);
            const taken=visits.some(row => row.status==="confirmed" || row.status==="blocked");
            const available=validSlot(day,time) && !taken;
            if (!visits.length && !available) return null;
            return <div className="workshop-slot" key={time}>
              <time>{time}</time>
              {available && <span className="workshop-available">{t("空闲","Available")}</span>}
              {visits.map(row => {
                const estimate = row.status === "confirmed" || row.status === "requested" ? workEstimate(row.service, lang) : null;
                return <button key={row.id} onClick={() => onDate(day)}
                  className={`workshop-event workshop-event--${row.status}`} data-service={row.service}>
                  {row.status!=="blocked" && <strong>{serviceName(row.service,lang)}</strong>}
                  <span>{row.status==="requested"
                    ? (taken ? t("待确认 · 冲突","Requested · clash") : t("待确认","Requested"))
                    : statusLabel(row.status,lang)}</span>
                  {estimate && <span className="small">{estimate}</span>}
                </button>;
              })}
            </div>;
          })}
          {!times.some(time=>validSlot(day,time))&&!entries.some(row=>row.date===day)&&
            <p className="small muted">{t("暂无可约时段","No available slots")}</p>}
        </section>)}
      </div>
    </div>
  </section>;
}

export function WorkshopRequest({date, lang, busy, onCreate}: {
  date:string; lang:Lang; busy:boolean; onCreate:(payload:Record<string,unknown>)=>Promise<boolean>;
}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const requestId = useRef<string | null>(null);
  const opening = times.filter(time=>validSlot(date,time));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    requestId.current ??= crypto.randomUUID();
    if (await onCreate({...Object.fromEntries(new FormData(form)),date,requestId:requestId.current})) {
      requestId.current=null;
      form.reset();
    }
  }
  return <details className="panel">
    <summary>{t("添加待确认请求","Add requested appointment")}</summary>
    <p className="muted">{date} · {t("选择客户希望的时间。确认后才占用时段。","Select the requested time. A slot is held only after confirmation.")}</p>
    {opening.length ? <form key={date} onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="workshop-form-grid">
          <label className="field">{t("时间","Time")}<select name="time">{opening.map(time=><option key={time}>{time}</option>)}</select></label>
          <label className="field">{t("服务","Service")}<select name="service">{services.map(service=><option key={service.id} value={service.id}>{service[lang]}</option>)}</select></label>
          <label className="field">{t("姓名","Name")}<input name="name" required maxLength={80}/></label>
          <label className="field">{t("邮箱","Email")}<input name="email" type="email" required maxLength={150}/></label>
          <label className="field">{t("联系电话","Phone")}<input name="phone" type="tel" required maxLength={30}/></label>
          <label className="field">{t("车辆品牌、车型和年份","Vehicle make, model & year")}<input name="vehicle" required maxLength={120} placeholder="2020 Toyota Corolla"/></label>
        </div>
        <label className="field">{t("备注","Notes")}<textarea name="notes" rows={2} maxLength={1000}/></label>
        <button className="primary">{t("保存待确认请求","Save request")}</button>
      </fieldset>
    </form> : <p className="notice">{t("请在周历选择一个未来营业日。","Select a future opening day in the calendar.")}</p>}
  </details>;
}

export function WorkshopSettings({lang}: {lang:Lang}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [notice,setNotice]=useState<NoticeText | null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  useEffect(() => {
    const controller=new AbortController();
    readWorkshopNotice(controller.signal).then(setNotice).catch(() => {
      if (!controller.signal.aborted) setError("UNAVAILABLE");
    });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!notice || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result=await api("adminNotice",notice);
      setNotice(result.notice);
      setSaved(true);
    } catch(e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="panel">
    <h2>{t("店铺设置","Workshop settings")}</h2>
    <p>{workshopContact.phone} · {workshopContact.address}</p>
    <p className="muted">{t("公告显示在首页预约区。关闭预约时段请使用上方时段管理。","The notice appears beside the home booking form. To close appointment slots, use availability controls above.")}</p>
    {error&&<p className="error" role="alert">{errorText(error,lang)}</p>}
    {saved&&<p className="notice" role="status">{t("营业公告已更新。","Workshop notice updated.")}</p>}
    {notice&&<form onSubmit={save}>
      <fieldset disabled={busy}>
        <label className="field">English<textarea value={notice.en} onChange={e=>{setSaved(false);setNotice({...notice,en:e.target.value})}} maxLength={500} rows={2}/></label>
        <label className="field">中文<textarea value={notice.zh} onChange={e=>{setSaved(false);setNotice({...notice,zh:e.target.value})}} maxLength={500} rows={2}/></label>
        <p className="small muted">{t("清空两种语言并保存即可撤下公告。","Save both fields empty to remove the notice.")}</p>
        <button className="primary">{t("保存公告","Save notice")}</button>
      </fieldset>
    </form>}
  </section>;
}
