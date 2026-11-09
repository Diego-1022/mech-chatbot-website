"use client";

import {useEffect, useRef, useState, type FormEvent, type MouseEvent} from "react";
import {api, errorText, statusLabel} from "@/lib/client";
import {datePlus, services, serviceName, times, todaySydney, validSlot, type Lang} from "@/lib/catalog";
import {extractBooking} from "@/lib/conversation-booking";
import {bookingDetailsSchema} from "@/lib/booking-input";
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
  const [requestDate, setRequestDate] = useState(date);
  const [service, setService] = useState(services[0].id);
  const [emailText, setEmailText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importedTime, setImportedTime] = useState<string | null>(null);
  const requestId = useRef<{id:string; details:string} | null>(null);
  const opening = times.filter(time=>validSlot(requestDate,time));

  function importEmail(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form || !emailText.trim()) return;
    // Ignore quoted replies and mail headers so addresses and dates there do not prefill a request.
    const body = emailText.split(/^(?:>|On .+wrote:|[- ]*Original Message[- ]*)/im,1)[0]
      .replace(/^(?:from|to|sent|date|cc|bcc):[^\r\n]*$/gim,"");
    try {
      const {draft} = extractBooking(body);
      // An email's relative dates depend on when it was sent. Require an exact date for prefill.
      const exactDate = body.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
      const validDate = exactDate && times.some(time=>validSlot(exactDate,time));
      setRequestDate(validDate ? exactDate : "");
      setImportedTime(validDate && draft.time && validSlot(exactDate,draft.time) ? draft.time : "");
      setService(draft.service ?? "");
      for (const name of ["name","email","phone","vehicle","notes"] as const) {
        const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
        const result = bookingDetailsSchema.shape[name].safeParse(draft[name]);
        input.value = result.success ? result.data : "";
      }
      setImportMessage(t("请核对已填内容，并补充空白项。","Check the filled details and complete any empty fields."));
    } catch {
      setImportMessage(t("未能提取预约信息，请手动填写。","Could not extract booking details. Enter them manually."));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    const payload=Object.fromEntries(new FormData(form));
    const details=JSON.stringify(payload);
    if (requestId.current?.details!==details) requestId.current={id:crypto.randomUUID(),details};
    if (await onCreate({...payload,requestId:requestId.current.id})) {
      requestId.current=null;
      form.reset();
      setRequestDate(date);
      setService(services[0].id);
      setImportedTime(null);
      setEmailText("");
      setImportMessage("");
    }
  }

  return <details className="panel">
    <summary>{t("添加待确认请求","Add requested appointment")}</summary>
    <p className="muted">{t("确认后才占用时段。所有时间均为悉尼当地时间。","A slot is held only after confirmation. All times are Sydney local time.")}</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <label className="field">{t("粘贴预约邮件（可选）","Paste appointment email (optional)")}
          <textarea value={emailText} onChange={e=>{setEmailText(e.target.value);setImportMessage("");}} maxLength={4000} rows={4}/>
        </label>
        <p className="small muted">{t("请粘贴最新一封邮件的正文。日期建议用 YYYY-MM-DD，邮箱请写在正文内。","Paste the latest email body. Use YYYY-MM-DD for the date and include the customer email in the body.")}</p>
        <button type="button" className="secondary" disabled={!emailText.trim()} onClick={importEmail}>{t("提取预约信息","Extract booking details")}</button>
        {importMessage && <p className="notice" role="status">{importMessage}</p>}
        <div className="workshop-form-grid">
          <label className="field">{t("日期","Date")}<input name="date" type="date" required min={todaySydney()} max={datePlus(todaySydney(),60)} value={requestDate} onChange={e=>{setRequestDate(e.target.value);setImportedTime("");}}/></label>
          <label className="field">{t("时间","Time")}<select name="time" required value={importedTime === null ? opening[0] ?? "" : opening.includes(importedTime) ? importedTime : ""} onChange={e=>setImportedTime(e.target.value)}>
            <option value="">{t("选择时间","Select time")}</option>
            {opening.map(time=><option key={time}>{time}</option>)}
          </select></label>
          <label className="field">{t("服务","Service")}<select name="service" required value={service} onChange={e=>setService(e.target.value)}>{services.map(service=><option key={service.id} value={service.id}>{service[lang]}</option>)}<option value="">{t("选择服务","Select service")}</option></select></label>
          <label className="field">{t("姓名","Name")}<input name="name" required maxLength={80}/></label>
          <label className="field">{t("邮箱","Email")}<input name="email" type="email" required maxLength={150}/></label>
          <label className="field">{t("联系电话","Phone")}<input name="phone" type="tel" required maxLength={30}/></label>
          <label className="field">{t("车辆品牌、车型和年份","Vehicle make, model & year")}<input name="vehicle" required maxLength={120} placeholder="2020 Toyota Corolla"/></label>
        </div>
        <label className="field">{t("备注","Notes")}<textarea name="notes" rows={2} maxLength={1000}/></label>
        <button className="primary" disabled={!opening.length}>{t("保存待确认请求","Save request")}</button>
      </fieldset>
    </form>
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
