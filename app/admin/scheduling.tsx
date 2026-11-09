"use client";

import {useState} from "react";
import {errorText} from "@/lib/client";
import {type Lang} from "@/lib/catalog";
import {estimateWork,type PlanningBooking} from "@/lib/workshop-scheduling";
import ConfirmAction from "@/components/confirm-action";

type Slot = {date:string;time:string};

export function BookingSchedule({booking,lang,busy,onApply}: {
  booking:PlanningBooking & {id:string};
  lang:Lang;
  busy:boolean;
  onApply:(payload:Record<string,unknown>)=>Promise<boolean>;
}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const [capacity,setCapacity]=useState(1);
  const [slots,setSlots]=useState<Slot[] | null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const estimate=estimateWork(booking.service,booking.vehicle);
  const requested=booking.status==="requested";

  async function suggest() {
    setLoading(true);
    setSlots(null);
    setError("");
    try {
      const query=new URLSearchParams({action:"adminSchedule",id:booking.id,capacity:String(capacity)});
      const response=await fetch("/api/workshop?"+query);
      const result=await response.json<{slots?:Slot[];error?:string}>();
      if(!response.ok||!result.slots)throw new Error(result.error??"UNAVAILABLE");
      setSlots(result.slots);
    } catch(e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return <details>
    <summary>{t("工时与排班建议","Work estimate & scheduling")}</summary>
    <p>{t("预计工时","Estimated work")} · {estimate.min}–{estimate.max} {t("分钟","minutes")}</p>
    {estimate.large && <p className="small muted">{t("按识别到的大型车型调整。","Adjusted for a recognised large vehicle.")}</p>}
    {estimate.electrified && <p className="small muted">{t("按识别到的混动或电动车型调整。","Adjusted for a recognised hybrid or electric vehicle.")}</p>}
    <p className="small muted">{t("排班按到店即开工估算，使用工时上限计算重叠。请填写可同时工作的技师人数。","Suggestions assume work begins at check-in and use the upper estimate to calculate overlaps. Enter how many technicians can work concurrently.")}</p>
    <label className="field">{t("同时工作的技师人数","Concurrent technicians")}
      <select value={capacity} disabled={busy||loading} onChange={event=>{setCapacity(Number(event.target.value));setSlots(null);}}>
        {Array.from({length:10},(_,index)=>index+1).map(count=><option key={count}>{count}</option>)}
      </select>
    </label>
    <button type="button" className="secondary" disabled={busy||loading} onClick={suggest}>
      {loading?t("正在查找…","Finding slots…"):t("查找建议时段","Find suggested slots")}
    </button>
    {error && <p role="alert">{errorText(error,lang)}</p>}
    {slots?.length===0 && <p role="status">{t("所查七天内没有合适的时段。","No suitable slots in the seven-day search window.")}</p>}
    {slots?.map(slot=><div className="actions" key={slot.date+slot.time}>
      <ConfirmAction lang={lang} disabled={busy||loading}
        label={(requested?t("确认","Confirm"):t("改期至","Move to"))+" "+slot.date+" · "+slot.time}
        description={t("保存前会重新检查时段和技师容量。请与客户确认新的到店时间。","The slot and capacity will be checked again before saving. Confirm the check-in time with the customer.")}
        onConfirm={async()=>{
          setSlots(null);
          await onApply({...slot,id:booking.id,capacity,originalDate:booking.date,originalTime:booking.time,originalStatus:booking.status});
        }}/>
    </div>)}
  </details>;
}
