"use client";

import {useEffect, useState, type FormEvent} from "react";
import {api,errorText} from "@/lib/client";
import {todaySydney,type Lang} from "@/lib/catalog";
import {EmailEstimates} from "./email-estimates";
import {bookingEstimate,type FinancialAnalysis,type FinancialSummary} from "@/lib/workshop-financials";

function MonthlyAnalysis({lang,month,hasData}: {lang:Lang;month:string;hasData:boolean}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [analysis,setAnalysis] = useState<FinancialAnalysis | null>(null);
  const [busy,setBusy] = useState(false);
  const [empty,setEmpty] = useState(false);
  const [error,setError] = useState("");

  async function generate() {
    setBusy(true);
    setEmpty(false);
    setError("");
    setAnalysis(null);
    try {
      const result = await api("adminFinancialAnalysis",{month,lang});
      setAnalysis(result.analysis);
      setEmpty(result.analysis===null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="financial-analysis">
    <h3>{t("AI 分析与建议","AI analysis & recommendations")}</h3>
    {hasData && <p className="small muted">{t("生成时会将该月的汇总金额和预约数量发送给 OpenAI。","Generating an analysis sends this month’s aggregate amounts and booking counts to OpenAI.")}</p>}
    {hasData && <button type="button" className="secondary" disabled={busy} onClick={generate}>
      {analysis?t("重新生成分析","Regenerate analysis"):t("生成月度分析","Generate monthly analysis")}
    </button>}
    {busy && <p role="status">{t("正在分析所选月份…","Analysing the selected month…")}</p>}
    {(!hasData||empty) && <p className="small muted" role="status">{t("所选月份还没有已登记收款或可分析的预约。","There are no recorded receipts or bookings to analyse for this month.")}</p>}
    {error && <p className="error" role="alert">{error==="AI_LIMIT"
      ? t("已达到 AI 每日使用上限，请稍后再试。","The daily AI limit has been reached. Try again later.")
      : error==="AI_BUSY"||error==="AI_UNAVAILABLE"
        ? t("AI 分析暂不可用，请稍后重试。","AI analysis is temporarily unavailable. Try again shortly.")
        : errorText(error,lang)}</p>}
    {analysis && <div aria-live="polite">
      <p>{analysis.summary}</p>
      <h4>{t("数据观察","Observations")}</h4>
      <ul>{analysis.observations.map((item,index)=><li key={index}>{item}</li>)}</ul>
      <h4>{t("建议行动","Suggested actions")}</h4>
      <ul>{analysis.recommendations.map((item,index)=><li key={index}>{item}</li>)}</ul>
    </div>}
  </section>;
}

export function WorkshopFinancials({lang, revision}: {lang:Lang; revision:number}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [month, setMonth] = useState(todaySydney().slice(0,7));
  const [loaded, setLoaded] = useState<{month:string;revision:number;summary:FinancialSummary} | null>(null);
  const summary = loaded?.month===month && loaded.revision===revision ? loaded.summary : null;
  const [failed, setFailed] = useState(false);
  const currency = new Intl.NumberFormat(lang === "zh" ? "zh-AU" : "en-AU",{style:"currency",currency:"AUD"});

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/workshop?action=adminFinancials&month="+encodeURIComponent(month),{signal:controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error("UNAVAILABLE");
        const result = await response.json<FinancialSummary>();
        if (!controller.signal.aborted) setLoaded({month,revision,summary:result});
      })
      .catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [month,revision]);

  function range(status: "requested" | "confirmed") {
    if (!summary) return currency.format(0);
    const {low,high,count,unpricedCount}=bookingEstimate(summary,status);
    const estimate=count?currency.format(low)+" – "+currency.format(high)+" ("+count+")":currency.format(0);
    return unpricedCount?estimate+" · "+unpricedCount+" "+t("笔未估价","unpriced"):estimate;
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
    {summary && <EmailEstimates month={month} lang={lang} prices={summary.prices}/>}
    {summary && <MonthlyAnalysis key={month+":"+revision+":"+lang} lang={lang} month={month}
      hasData={summary.receipts.count>0||summary.forecast.length>0}/>}
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
