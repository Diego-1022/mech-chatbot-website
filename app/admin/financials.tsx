"use client";

import {useEffect, useState, type FormEvent} from "react";
import {errorText} from "@/lib/client";
import {services, todaySydney, type Lang} from "@/lib/catalog";

type FinancialSummary = {
  receipts: {count:number; cents:number};
  forecast: {service:string; status:"requested" | "confirmed"; count:number}[];
};

export function WorkshopFinancials({lang, revision}: {lang:Lang; revision:number}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [month, setMonth] = useState(todaySydney().slice(0,7));
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const currency = new Intl.NumberFormat(lang === "zh" ? "zh-AU" : "en-AU",{style:"currency",currency:"AUD"});

  useEffect(() => {
    const controller = new AbortController();
    setSummary(null);
    setFailed(false);
    fetch("/api/workshop?action=adminFinancials&month="+encodeURIComponent(month),{signal:controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error("UNAVAILABLE");
        const result = await response.json<FinancialSummary>();
        if (!controller.signal.aborted) setSummary(result);
      })
      .catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [month,revision]);

  function range(status: "requested" | "confirmed") {
    let low = 0, high = 0, count = 0;
    for (const row of summary?.forecast ?? []) {
      if (row.status !== status) continue;
      const service = services.find(item=>item.id===row.service);
      if (!service) continue;
      low += service.min * row.count;
      high += service.max * row.count;
      count += row.count;
    }
    return count ? currency.format(low)+" – "+currency.format(high)+" ("+count+")" : currency.format(0);
  }

  return <section className="panel">
    <h2>{t("财务概览","Financial overview")}</h2>
    <label className="field">{t("月份","Month")}<input type="month" min="2000-01" max="2099-12" value={month}
      onChange={event=>{if (event.target.value && event.target.validity.valid) setMonth(event.target.value);}}/></label>
    {failed && <p className="error" role="alert">{errorText("UNAVAILABLE",lang)}</p>}
    {!failed && !summary && <p role="status">{t("正在读取…","Loading…")}</p>}
    {summary && <dl>
      <dt>{t("已登记收款（按收款日期）","Recorded receipts by payment date")}</dt>
      <dd><strong>{currency.format(summary.receipts.cents/100)}</strong> · {summary.receipts.count} {t("笔","receipts")}</dd>
      <dt>{t("已确认预约估算（按到店日期）","Confirmed booking estimates by visit date")}</dt>
      <dd>{range("confirmed")}</dd>
      <dt>{t("待确认请求估算（按到店日期）","Pending request estimates by visit date")}</dt>
      <dd>{range("requested")}</dd>
    </dl>}
    <p className="small muted">{t("估算使用服务目录的价格区间。已登记收款来自管理员录入的实际到账金额。","Estimates use the service catalogue’s price ranges. Recorded receipts come from payments entered by an administrator.")}</p>
  </section>;
}

export function WorkshopReceipt({id,paidOn,cents,lang,busy,onSave}: {
  id:string; paidOn:string | null; cents:number | null; lang:Lang; busy:boolean;
  onSave:(details:{id:string;paidOn:string;amountCents:number})=>Promise<boolean>;
}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amountCents = Math.round(Number(fields.get("amount"))*100);
    await onSave({id,paidOn:String(fields.get("paidOn")),amountCents});
  }
  return <details>
    <summary>{cents === null ? t("登记收款","Record payment") : t("编辑收款","Edit recorded payment")}</summary>
    <form onSubmit={save} key={JSON.stringify([paidOn,cents])}>
      <fieldset disabled={busy}>
        <label className="field">{t("到账金额（澳元）","Amount received (AUD)")}
          <input name="amount" type="number" step="0.01" min="0.01" max="1000000" required defaultValue={cents === null ? "" : (cents/100).toFixed(2)}/>
        </label>
        <label className="field">{t("收款日期","Payment date")}
          <input name="paidOn" type="date" required max={todaySydney()} defaultValue={paidOn ?? todaySydney()}/>
        </label>
        <button className="secondary">{t("保存收款记录","Save payment record")}</button>
      </fieldset>
    </form>
  </details>;
}
