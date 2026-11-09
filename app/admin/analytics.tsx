"use client";

import {useEffect,useState} from "react";
import {type Lang} from "@/lib/catalog";
import {trackedPages} from "@/lib/workshop-analytics";

const labels = {
  "/":["首页","Home"],"/services":["服务","Services"],"/team":["维修团队","Team"],
  "/contact":["联系","Contact"],"/terms":["条款与隐私","Terms & privacy"],
} as const;

export function WorkshopAnalytics({lang}: {lang:Lang}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const [views,setViews]=useState<Record<string,number> | null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/workshop?action=adminAnalytics",{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("UNAVAILABLE");
      const {pages}=await response.json<{pages:{page:string;views:number}[]}>();
      if(!controller.signal.aborted)setViews(Object.fromEntries(pages.map(({page,views})=>[page,views])));
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[]);
  return <section className="panel">
    <h2>{t("网站访问统计","Website analytics")}</h2>
    <p>{t("最近 30 个悉尼日历日的公开页面浏览量，含今天。","Public page views over the last 30 Sydney calendar days, including today.")}</p>
    {failed && <p className="error" role="alert">{t("暂时无法读取统计。","Analytics unavailable.")}</p>}
    {!views && !failed && <p role="status">{t("正在读取…","Loading…")}</p>}
    {views && <>
      <p><strong>{Object.values(views).reduce((total,value)=>total+value,0).toLocaleString(lang==="zh"?"zh-CN":"en-AU")}</strong> {t("次浏览","total views")}</p>
      <dl className="detail-list">
        {trackedPages.map(page=><div key={page}><dt>{labels[page][lang==="zh"?0:1]}</dt><dd>{views[page]??0}</dd></div>)}
      </dl>
    </>}
  </section>;
}
