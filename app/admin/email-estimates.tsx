"use client";

import {useEffect,useState} from "react";
import {adminInboxEvent,emailAppointment,readAdminInbox,type InboxMessage} from "@/lib/admin-email";
import {withServicePrices,type Lang,type ServicePrice} from "@/lib/catalog";

export function EmailEstimates({month,lang,prices}: {month:string;lang:Lang;prices:ServicePrice[]}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  useEffect(()=>{
    const update=()=>setMessages(readAdminInbox());
    update();
    window.addEventListener(adminInboxEvent,update);
    return ()=>window.removeEventListener(adminInboxEvent,update);
  },[]);
  const catalogue=withServicePrices(prices);
  const relevant=messages.flatMap(message=>{
    if(message.category!=="appointment")return [];
    const request=emailAppointment(message);
    return request.date?.slice(0,7)===month?[request]:[];
  });
  const estimates=relevant.flatMap(request=>{
    const service=catalogue.find(item=>item.id===request.service);
    return service?[service]:[];
  });
  const summary=estimates.reduce((total,item)=>({low:total.low+item.min,high:total.high+item.max}),{low:0,high:0});
  const money=new Intl.NumberFormat(lang==="zh"?"zh-CN":"en-AU",{style:"currency",currency:"AUD"});
  return <section className="financial-analysis">
    <h3>{t("邮件预约估算","Email appointment estimates")}</h3>
    {estimates.length
      ? <p><strong>{money.format(summary.low)} – {money.format(summary.high)}</strong> · {estimates.length} {t("封","emails")}</p>
      : <p>{t("所选月份没有可估价的邮件预约。","No email appointments can be estimated for this month.")}</p>}
    {relevant.length>estimates.length && <p>{relevant.length-estimates.length} {t("封邮件需确认服务项目。","emails need a service before they can be estimated.")}</p>}
    <p className="small muted">{t("按到店月份统计此标签页收件箱中的预约邮件，并采用服务目录价格。部分邮件可能已登记为预约，因此请单独查看。","Uses catalogue prices for appointment emails in this tab, grouped by visit month. Some emails may already have a booking record, so view this estimate separately.")}</p>
    <a className="link" href="/admin/email">{t("打开邮件","Open Email")}</a>
  </section>;
}
