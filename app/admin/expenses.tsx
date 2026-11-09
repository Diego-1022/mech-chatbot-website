"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import ConfirmAction from "@/components/confirm-action";
import {api,errorText} from "@/lib/client";
import {todaySydney,type Lang} from "@/lib/catalog";

type Expense = {
  id:string; item:string; supplier:string; kind:"purchase" | "recurring"; quantity:number;
  amount_cents:number; due_on:string; status:"open" | "settled" | "cancelled"; repeat_months:number;
};

export function WorkshopExpenses({lang}: {lang:Lang}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const today=todaySydney();
  const [month,setMonth]=useState(today.slice(0,7));
  const [recurring,setRecurring]=useState(false);
  const [expenses,setExpenses]=useState<Expense[] | null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const request=useRef<{id:string; key:string} | null>(null);
  const money=new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"});

  useEffect(()=>{
    const controller=new AbortController();
    setExpenses(null);
    fetch("/api/workshop?action=adminExpenses&month="+encodeURIComponent(month),{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error("UNAVAILABLE");
        const result=await response.json<{expenses:Expense[]}>();
        if(!controller.signal.aborted)setExpenses(result.expenses);
      })
      .catch(()=>{if(!controller.signal.aborted)setError("UNAVAILABLE");});
    return ()=>controller.abort();
  },[month,revision]);

  async function change(action:string,payload:Record<string,unknown>){
    setBusy(true);
    setError("");
    try{
      await api(action,payload);
      setRevision(value=>value+1);
      return true;
    }catch(e){
      setError((e as Error).message);
      return false;
    }finally{setBusy(false);}
  }

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const values=new FormData(form);
    const dueOn=String(values.get("dueOn"));
    const payload={
      item:values.get("item"),supplier:values.get("supplier"),dueOn,
      kind:recurring?"recurring":"purchase",quantity:Number(values.get("quantity")??1),
      amountCents:Math.round(Number(values.get("amount"))*100),repeatMonths:Number(values.get("repeatMonths")??1),
    };
    const key=JSON.stringify(payload);
    if(request.current?.key!==key)request.current={id:crypto.randomUUID(),key};
    if(await change("adminExpense",{...payload,id:request.current.id})){
      request.current=null;
      form.reset();
      setMonth(dueOn.slice(0,7));
      setRecurring(false);
    }
  }

  return <section className="panel">
    <h2>{t("采购与定期付款台账","Purchases & recurring payments")}</h2>
    <p className="small muted">{t("记录采购和应付款。标记定期付款已付后，系统会建立下一期记录。","Track purchases and bills. Mark a recurring bill paid to create its next entry.")}</p>
    {error && <p className="error" role="alert">{errorText(error,lang)}</p>}
    <details>
      <summary>{t("添加台账记录","Add ledger entry")}</summary>
      <form onSubmit={create}>
        <fieldset disabled={busy}>
          <div className="workshop-form-grid">
            <label className="field">{t("类型","Type")}<select value={recurring?"recurring":"purchase"} onChange={e=>setRecurring(e.target.value==="recurring")}>
              <option value="purchase">{t("采购","Purchase")}</option><option value="recurring">{t("定期付款","Recurring bill")}</option>
            </select></label>
            <label className="field">{t("项目","Item")}<input name="item" required maxLength={100}/></label>
            <label className="field">{t("供应商或收款方","Supplier or payee")}<input name="supplier" required maxLength={100}/></label>
            <label className="field">{t("总额（澳元）","Total (AUD)")}<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required/></label>
            <label className="field">{t("到期日","Due date")}<input name="dueOn" type="date" min="2000-01-01" max="2099-12-31" defaultValue={today} required/></label>
            {recurring
              ? <label className="field">{t("周期","Frequency")}<select name="repeatMonths">
                <option value="1">{t("每月","Monthly")}</option><option value="3">{t("每季度","Quarterly")}</option><option value="12">{t("每年","Yearly")}</option>
              </select></label>
              : <label className="field">{t("数量","Quantity")}<input name="quantity" type="number" min="1" max="10000" defaultValue="1" required/></label>}
          </div>
          <button className="primary">{t("保存记录","Save entry")}</button>
        </fieldset>
      </form>
    </details>
    <label className="field">{t("到期月份","Due month")}<input type="month" min="2000-01" max="2099-12" value={month}
      onChange={e=>{if(e.target.value&&e.target.validity.valid)setMonth(e.target.value);}}/></label>
    {!expenses && !error && <p role="status">{t("正在读取…","Loading…")}</p>}
    {expenses?.length===0 && <p>{t("这个月没有记录。","No entries this month.")}</p>}
    {expenses?.map(row=><article className="booking-entry" key={row.id}>
      <strong>{row.item} · {money.format(row.amount_cents/100)}</strong>
      <p>{row.supplier} · {row.due_on} · {row.kind==="purchase"
        ? t("数量 ","Qty ")+row.quantity : t("每 "+row.repeat_months+" 个月","Every "+row.repeat_months+" month(s)")}</p>
      <p>{row.status==="open"?t("待付款","Unpaid"):row.status==="settled"?t("已付款","Paid"):t("已取消","Cancelled")}</p>
      {row.status==="open" && <div className="actions">
        <ConfirmAction lang={lang} disabled={busy} label={t("标记已付款","Mark paid")}
          description={t("确认已付款并更新内部台账。","Confirm the payment was made and update the ledger.")}
          onConfirm={async()=>{await change("adminSettleExpense",{id:row.id});}}/>
        <ConfirmAction lang={lang} disabled={busy} label={t("取消记录","Cancel entry")}
          description={t("取消这一笔待付款记录。定期付款也会停止生成下一期。","Cancel this unpaid entry. A recurring bill will also stop generating new entries.")}
          onConfirm={async()=>{await change("adminCancelExpense",{id:row.id});}}/>
      </div>}
    </article>)}
  </section>;
}
