"use client";

import {useEffect, useRef, useState} from "react";
import {RefreshCw} from "lucide-react";
import {api,errorText,statusLabel} from "@/lib/client";
import {todaySydney,times,validSlot,serviceName,type Lang} from "@/lib/catalog";
import ConfirmAction from "@/components/confirm-action";
import {PhotoGallery} from "@/components/booking-photos";
import {WorkshopWeek,WorkshopRequest,mondayOf,type CalendarEntry} from "./workshop-tools";
import {WorkshopReceipt} from "./financials";
import {AppointmentPlanner} from "./appointment-planner";
import {BookingSchedule} from "./scheduling";

type Appointment = CalendarEntry & {
  name:string;
  vehicle:string;
  email:string;
  phone:string;
  notes:string;
  paid_on:string|null;
  amount_cents:number|null;
  photos:React.ComponentProps<typeof PhotoGallery>["photos"];
};

export function AppointmentWorkspace({lang}: {lang:Lang}) {
  const t = (zh:string,en:string) => lang==="zh"?zh:en;
  const [date,setDate] = useState(todaySydney());
  const [rows,setRows] = useState<Appointment[]>([]);
  const [week,setWeek] = useState<CalendarEntry[]>([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [email,setEmail] = useState("");
  const [openRequest,setOpenRequest] = useState(0);
  const loadVersion = useRef(0);

  useEffect(()=>{
    const value = new URLSearchParams(window.location.search).get("date");
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(value+"T00:00:00Z");
      if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value) setDate(value);
    }
    try {
      const handoff = sessionStorage.getItem("harbour-email-booking");
      if(handoff) {
        setEmail(handoff.slice(0,4000));
        sessionStorage.removeItem("harbour-email-booking");
      }
    } catch {}
  },[]);

  useEffect(()=>{
    if(email)document.getElementById("request-appointment")?.scrollIntoView({block:"start"});
  },[email]);

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try{
      const [day,calendar] = await Promise.all([
        fetch("/api/workshop?action=admin&date="+encodeURIComponent(date)),
        fetch("/api/workshop?action=adminWeek&start="+encodeURIComponent(mondayOf(date))),
      ]);
      const [details,summary] = await Promise.all([
        day.json<{bookings:Appointment[];error?:string}>(),
        calendar.json<{bookings:CalendarEntry[];error?:string}>(),
      ]);
      if (!day.ok || !calendar.ok) throw new Error((day.ok?summary:details).error || "UNAVAILABLE");
      if (version===loadVersion.current) {
        setRows(details.bookings);
        setWeek(summary.bookings);
      }
    } catch(e) {
      if (version===loadVersion.current) setError((e as Error).message);
    } finally {
      if (version===loadVersion.current) setLoading(false);
    }
  }

  useEffect(()=>{ void load(); },[date]);

  async function action(name:string,body:Record<string,unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await api(name,body);
      await load();
      return true;
    } catch(e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const active = rows.filter(row=>row.status==="confirmed");
  const blocked = rows.filter(row=>row.status==="blocked");
  const appointments = rows.filter(row=>row.status!=="blocked" && row.name);

  return <div className="admin-view">
    <div className="admin-view-header"><h1>{t("预约","Appointments")}</h1><a className="admin-backlink" href="#request-appointment" onClick={()=>setOpenRequest(value=>value+1)}>{t("添加请求","Add request")}</a></div>
    <WorkshopWeek date={date} entries={week} lang={lang} onDate={value=>{if(!busy)setDate(value)}}/>
    <AppointmentPlanner key={mondayOf(date)} start={mondayOf(date)} lang={lang} disabled={busy||loading} onApplied={load}/>
    <section className="panel" id="appointment-day">
      <div className="toolbar">
        <label className="field" style={{margin:0}}>{t("查看日期","View date")}
          <input type="date" value={date} min="2000-01-01" max="2099-12-31"
            onChange={e=>{if(!busy && e.target.value && e.target.validity.valid)setDate(e.target.value)}}/>
        </label>
        <button className="secondary" disabled={loading||busy} onClick={load}><RefreshCw size={17}/>{t("刷新","Refresh")}</button>
        {!loading && <span className="status">{active.length} {t("个有效预约","active appointments")}</span>}
      </div>
      {error && <p className="error" role="alert">{errorText(error,lang)}</p>}
      {loading ? <p className="notice" role="status">{t("正在读取…","Loading…")}</p>
        : <div style={{marginTop:20}}>
          {!appointments.length && <p className="notice">{t("当天还没有客户预约。","No customer appointments for this date.")}</p>}
          {appointments.map(row=><article className={"booking-entry "+(row.status!=="confirmed"?"closed":"")} key={row.id}>
            <div className="toolbar" style={{justifyContent:"space-between"}}>
              <h3>{row.time} · {serviceName(row.service,lang)}</h3>
              <span className="status">{row.status==="requested"?t("待确认","Requested"):statusLabel(row.status,lang)}</span>
            </div>
            <p>{row.name} · {row.vehicle}</p>
            <p className="muted">{row.email} · {row.phone}</p>
            {row.notes && <p className="notice">{row.notes}</p>}
            <PhotoGallery photos={row.photos||[]} lang={lang}/>
            <p className="small muted">{t("编号","Ref")} {row.id.slice(0,8).toUpperCase()}</p>
            {row.status==="requested" && <div className="actions">
              <ConfirmAction disabled={busy||active.some(item=>item.time===row.time)||blocked.some(item=>item.time===row.time)||!validSlot(row.date,row.time)}
                lang={lang} label={t("确认请求","Confirm request")} description={t("确认后将占用该接车时段。","Confirming reserves this check-in slot.")}
                onConfirm={async()=>{await action("adminConfirmRequest",{id:row.id});}}/>
              <ConfirmAction disabled={busy} lang={lang} label={t("取消请求","Cancel request")}
                description={t("取消此待确认请求。","Cancel this tentative request.")}
                onConfirm={async()=>{await action("adminStatus",{id:row.id,status:"cancelled"});}}/>
            </div>}
            {row.status==="confirmed" && <div className="actions">
              <ConfirmAction disabled={busy} lang={lang} label={t("标记完成","Mark complete")}
                description={t("确认此预约的服务已完成。","Confirm that service for this appointment is complete.")}
                onConfirm={async()=>{await action("adminStatus",{id:row.id,status:"completed"});}}/>
              <ConfirmAction disabled={busy} lang={lang} label={t("取消预约","Cancel booking")}
                description={t("这会释放时段，请另行通知客户。","This releases the appointment time. Contact the customer separately.")}
                onConfirm={async()=>{await action("adminStatus",{id:row.id,status:"cancelled"});}}/>
            </div>}
            {(row.status==="requested"||row.status==="confirmed") && <BookingSchedule booking={row} lang={lang} busy={busy}
              onApply={async payload=>{
                const saved=await action("adminApplySchedule",payload);
                if(saved&&typeof payload.date==="string")setDate(payload.date);
                return saved;
              }}/>}
            {row.status==="completed" && <WorkshopReceipt id={row.id} paidOn={row.paid_on} cents={row.amount_cents} lang={lang}
              busy={busy} onSave={payload=>action("adminReceipt",payload)}/>}
          </article>)}
        </div>}
    </section>
    <div id="request-appointment">
      <WorkshopRequest key={date} date={date} lang={lang} busy={busy||loading} initialEmail={email} openRequest={openRequest}
        onCreate={async payload=>{
          const saved=await action("adminRequest",payload);
          if(saved){
            setEmail("");
            if(typeof payload.date==="string")setDate(payload.date);
          }
          return saved;
        }}/>
    </div>
    <section className="panel">
      <h2>{t("管理可预约时段","Manage availability")}</h2>
      <p className="muted">{t("关闭空闲时段可阻止新预约。","Close an available time to prevent new bookings.")}</p>
      <div className="toolbar">
        {times.filter(time=>validSlot(date,time)).map(time=>{
          const closed=blocked.find(row=>row.time===time);
          const taken=active.some(row=>row.time===time);
          return <button className={closed?"primary":"secondary"} key={time} disabled={busy||loading||taken}
            onClick={()=>closed?action("adminStatus",{id:closed.id,status:"cancelled"}):action("block",{date,time})}>
            {time} · {taken?t("已预约","Booked"):closed?t("重新开放","Reopen"):t("关闭时段","Close")}
          </button>;
        })}
      </div>
      {!times.some(time=>validSlot(date,time)) && <p className="notice">{t("该日期没有可调整的未来营业时段。","No future opening times to edit for this date.")}</p>}
    </section>
  </div>;
}
