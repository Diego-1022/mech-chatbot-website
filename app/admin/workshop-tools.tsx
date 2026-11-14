"use client";

import {useEffect, useRef, useState, type FormEvent, type MouseEvent} from "react";
import {api, errorText, statusLabel} from "@/lib/client";
import {datePlus, services, serviceName, times, todaySydney, validSlot, type Lang} from "@/lib/catalog";
import {estimateWork} from "@/lib/workshop-scheduling";
import {extractBooking} from "@/lib/conversation-booking";
import {bookingDetailsSchema} from "@/lib/booking-input";
import {workshopContact} from "@/lib/workshop-info";
import {readWorkshopNotice, type NoticeText} from "@/components/workshop-notice";

export type CalendarEntry = {id:string; date:string; time:string; service:string; status:string};

function workEstimate(service: string, lang: Lang) {
  const {min,max} = estimateWork(service,"");
  return lang === "zh" ? "预计工时 "+min+"–"+max+" 分钟" : "Est. work "+min+"–"+max+" min";
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
                    ? (taken || !available ? t("待确认 · ✕ 不可约","Requested · ✕ unavailable") : t("待确认 · ✓ 可约","Requested · ✓ available"))
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

function RequestReply({date, time, available, lang}: {
  date:string; time:string; available:string[]; lang:Lang;
}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [draft, setDraft] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);

  function generate() {
    const alternatives = available.join(t("、", ", "));
    let message: string;
    if (available.includes(time)) {
      message = t(
        `您询问的 ${date} ${time}（悉尼时间）目前有空。请回复确认这个时间是否适合您。预约以我们另行发出的确认为准。`,
        `Your requested time of ${time} on ${date} (Sydney time) is currently available. Please let us know if that still suits you. We’ll confirm the booking separately.`,
      );
    } else if (available.length) {
      message = t(
        `${date} ${time}（悉尼时间）已无法预约。当天目前还有 ${alternatives} 可选。请回复您方便的时间，我们会再次核对并确认。`,
        `${time} on ${date} (Sydney time) is unavailable. These times are currently open that day: ${alternatives}. Please let us know which suits you so we can recheck and confirm.`,
      );
    } else {
      message = t(
        `${date} 目前没有可预约时段。请回复您方便的其他日期，我们会查看可用时间。`,
        `We have no available appointments on ${date}. Please send us another date that suits you so we can check availability.`,
      );
    }
    setDraft(t("您好，\n\n感谢您联系我们预约。", "Hello,\n\nThanks for getting in touch about an appointment.") +
      " " + message + t("\n\nHarbour Auto 团队", "\n\nHarbour Auto team"));
    setCopyStatus(null);
  }

  async function copy() {
    if (!draft?.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return <div>
    {draft === null && <button type="button" className="secondary" onClick={generate}>{t("生成邮件回复草稿","Generate email reply")}</button>}
    {draft !== null && <>
      <label className="field">{t("邮件回复草稿","Email reply draft")}
        <textarea rows={7} value={draft} onChange={e=>{setDraft(e.target.value);setCopyStatus(null);}}/>
      </label>
      <button type="button" className="secondary" disabled={!draft.trim()} onClick={copy}>{t("复制回复","Copy reply")}</button>
      {copyStatus && <p className="small" role="status">{copyStatus === "copied"
        ? t("已复制。","Reply copied.")
        : t("无法访问剪贴板，请手动复制。","Clipboard unavailable. Copy the draft manually.")}</p>}
    </>}
  </div>;
}

export function WorkshopRequest({date, lang, busy, onCreate, initialEmail="", openRequest=0}: {
  date:string; lang:Lang; busy:boolean; initialEmail?:string; openRequest?:number; onCreate:(payload:Record<string,unknown>)=>Promise<boolean>;
}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [requestDate, setRequestDate] = useState(date);
  const [expanded, setExpanded] = useState(false);
  const [availability, setAvailability] = useState<{date:string; times:string[] | null} | null>(null);
  const [service, setService] = useState(services[0].id);
  const [emailText, setEmailText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importedTime, setImportedTime] = useState<string | null>(null);
  const requestId = useRef<{id:string; details:string} | null>(null);
  useEffect(() => {
    if (!initialEmail) return;
    setEmailText(initialEmail);
    setExpanded(true);
  }, [initialEmail]);

  useEffect(() => {
    if (openRequest>0) setExpanded(true);
  }, [openRequest]);

  const opening = times.filter(time=>validSlot(requestDate,time));

  const selectedTime = importedTime === null ? opening[0] ?? "" : opening.includes(importedTime) ? importedTime : "";
  const availableTimes = availability?.date === requestDate ? availability.times : undefined;
  const selectedIsAvailable = availableTimes?.includes(selectedTime);

  useEffect(() => {
    if (!expanded || !times.some(time => validSlot(requestDate,time))) return;
    const controller = new AbortController();
    setAvailability(null);
    fetch("/api/workshop?action=availability&date=" + encodeURIComponent(requestDate), {
      signal:controller.signal, cache:"no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("Availability unavailable");
      const result = await response.json<{times:string[]}>();
      if (!Array.isArray(result.times)) throw new Error("Invalid availability");
      if (!controller.signal.aborted) setAvailability({date:requestDate,times:result.times});
    }).catch(() => {
      if (!controller.signal.aborted) setAvailability({date:requestDate,times:null});
    });
    return () => controller.abort();
  }, [expanded,requestDate,busy]);

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

  return <details className="panel" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
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
          <label className="field">{t("时间","Time")}<select name="time" required value={selectedTime} onChange={e=>setImportedTime(e.target.value)}>
            <option value="">{t("选择时间","Select time")}</option>
            {opening.map(time=><option key={time} value={time}>
              {time}{availableTimes && (availableTimes.includes(time) ? t(" · 空闲"," · Available") : t(" · 冲突"," · Clash"))}
            </option>)}
          </select></label>
          <label className="field">{t("服务","Service")}<select name="service" required value={service} onChange={e=>setService(e.target.value)}>{services.map(service=><option key={service.id} value={service.id}>{service[lang]}</option>)}<option value="">{t("选择服务","Select service")}</option></select></label>
          <label className="field">{t("姓名","Name")}<input name="name" required maxLength={80}/></label>
          <label className="field">{t("邮箱","Email")}<input name="email" type="email" required maxLength={150}/></label>
          <label className="field">{t("联系电话","Phone")}<input name="phone" type="tel" required maxLength={30}/></label>
          <label className="field">{t("车辆品牌、车型和年份","Vehicle make, model & year")}<input name="vehicle" required maxLength={120} placeholder="2020 Toyota Corolla"/></label>
        </div>
        {selectedTime && <p className="notice" role="status">
          {availableTimes === undefined ? t("正在检查时段…","Checking availability…")
            : availableTimes === null ? t("暂时无法检查时段。","Availability could not be checked.")
            : selectedIsAvailable ? t("✓ 当前空闲，确认前不会保留。","✓ Available now. The slot is held only after confirmation.")
            : t("✕ 时段有冲突。可以选择其他时间，或先保存客户原本的请求。","✕ This time clashes. Choose another time or save the customer's original request.")}
        </p>}
        {selectedTime && availableTimes && <RequestReply
          key={JSON.stringify([requestDate,selectedTime,availableTimes,lang])}
          date={requestDate} time={selectedTime} available={availableTimes} lang={lang}
        />}
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
    <p className="muted">{t("公告显示在首页预约区。如需关闭时段，请前往预约页面。","The notice appears beside the home booking form. To close check-in slots, use availability controls on Appointments.")}</p>
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
