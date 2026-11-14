"use client";

import {useState} from "react";
import {api,errorText} from "@/lib/client";
import {serviceName,type Lang} from "@/lib/catalog";
import ConfirmAction from "@/components/confirm-action";

type Plan = {id:string;date:string;time:string;service:string;option:{date:string;time:string}|null};

export function AppointmentPlanner({start,lang,disabled,onApplied}: {
  start:string;lang:Lang;disabled:boolean;onApplied:()=>Promise<void>;
}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const [capacity,setCapacity]=useState(1);
  const [plans,setPlans]=useState<Plan[]|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<{success:number;failed:number}|null>(null);
  const [error,setError]=useState("");

  async function preview() {
    setBusy(true);
    setPlans(null);
    setReport(null);
    setError("");
    try {
      const query=new URLSearchParams({action:"adminScheduleWeek",start,capacity:String(capacity)});
      const response=await fetch("/api/workshop?"+query);
      const result=await response.json<{plans?:Plan[];error?:string}>();
      if(!response.ok||!result.plans)throw new Error(result.error??"UNAVAILABLE");
      setPlans(result.plans);
      // Preselect requests that fit the exact time the customer asked for.
      setSelected(result.plans.filter(row=>row.option?.date===row.date&&row.option.time===row.time).map(row=>row.id));
    } catch(e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    let success=0,failed=0;
    try {
      for(const row of plans??[]) {
        if(!row.option||!selected.includes(row.id))continue;
        try {
          await api("adminApplySchedule",{
            id:row.id,capacity,...row.option,originalDate:row.date,originalTime:row.time,originalStatus:"requested",
          });
          success++;
        } catch {
          failed++;
        }
      }
      setPlans(null);
      setSelected([]);
      setReport({success,failed});
      await onApplied();
    } finally {
      setBusy(false);
    }
  }

  return <details className="panel">
    <summary>{t("批量排班","Plan pending appointments")}</summary>
    <p className="muted">{t("为本周的待确认请求查找合适时段。建议改期时，请先向客户核实再勾选。","Find slots for this week’s pending requests. Check alternative times with customers before selecting them.")}</p>
    <div className="toolbar">
      <label className="field">{t("同时工作的技师人数","Concurrent technicians")}
        <select value={capacity} disabled={disabled||busy} onChange={e=>{setCapacity(Number(e.target.value));setPlans(null);}}>
          {Array.from({length:10},(_,i)=>i+1).map(count=><option key={count}>{count}</option>)}
        </select>
      </label>
      <button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void preview()}>
        {t("预览建议时段","Preview proposed slots")}
      </button>
    </div>
    {busy&&<p role="status">{t("正在处理…","Working…")}</p>}
    {error&&<p className="error" role="alert">{errorText(error,lang)}</p>}
    {report&&<p role="status">{t("已确认","Confirmed")} {report.success} · {t("需重新检查","Need another check")} {report.failed}</p>}
    {plans?.length===0&&<p>{t("这周没有待确认请求。","No pending requests this week.")}</p>}
    {!!plans?.length&&<ul className="appointment-plan-list">
      {plans.map(row=><li key={row.id}>
        {row.option&&<input type="checkbox" disabled={disabled||busy} id={"plan-"+row.id} checked={selected.includes(row.id)}
          onChange={e=>{const checked=e.currentTarget.checked;setSelected(ids=>checked?[...ids,row.id]:ids.filter(id=>id!==row.id));}}/>}
        <label htmlFor={row.option?"plan-"+row.id:undefined}>
          <strong>{row.date} · {row.time} · {serviceName(row.service,lang)}</strong>
          <span>{row.option ? t("建议","Proposed")+" "+row.option.date+" · "+row.option.time : t("未找到合适时段","No suitable slot found")}</span>
        </label>
      </li>)}
    </ul>}
    {!!selected.length&&<ConfirmAction disabled={disabled||busy} lang={lang}
      label={t("确认所选预约","Confirm selected appointments")}
      description={t("系统将逐笔重新检查，并确认仍可预约的时段。","Each selected slot will be checked again and confirmed if still available.")}
      onConfirm={apply}/>}
  </details>;
}
