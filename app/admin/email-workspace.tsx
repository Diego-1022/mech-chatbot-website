"use client";

import {ArrowLeft, ChevronDown, CircleAlert, Download, Inbox, Mail, MailPlus, Sparkles} from "lucide-react";
import {useEffect,useState,type FormEvent} from "react";
import {todaySydney,validSlot,type Lang} from "@/lib/catalog";
import {
  classifyEmail,demoEmails,emailAppointment,emailCategories,emailGroups,emailHandoff,
  emailReplyDraft,emailSummary,groupEmail,inboxLimit,readAdminInbox,writeAdminInbox,
  type EmailCategory,type EmailGroup,type InboxMessage,type SlotCheck,
} from "@/lib/admin-email";
import "./email-workspace.css";

const categoryLabels:Record<EmailCategory,[string,string]> = {
  appointment:["预约","Appointments"], invoice:["发票","Invoices"],
  quote:["报价","Quotes"], general:["普通邮件","General"],
};
const groupLabels:Record<EmailGroup,[string,string]> = {
  today:["今天","Today"], tomorrow:["明天","Tomorrow"], yesterday:["昨天","Yesterday"],
  week:["过去 7 天","Last week"], month:["过去 30 天","Last month"],
  quarter:["过去 3 个月","Last 3 months"], half:["过去 6 个月","Last 6 months"],
  year:["过去 12 个月","Last year"], older:["更早","Older"],
};

function useSlotCheck(message?:InboxMessage):SlotCheck {
  const slot = message?.category === "appointment" ? emailAppointment(message) : {};
  const {date,time} = slot;
  const [result,setResult] = useState<{date:string;times:string[] | null} | null>(null);
  useEffect(()=>{
    if (!date || !time) return;
    const controller = new AbortController();
    fetch("/api/workshop?action=availability&date="+encodeURIComponent(date),{signal:controller.signal,cache:"no-store"})
      .then(async response=>{
        if (!response.ok) throw new Error("Availability unavailable");
        const data = await response.json() as {times:string[]};
        if (!controller.signal.aborted) setResult({date,times:data.times});
      })
      .catch(()=>{if (!controller.signal.aborted) setResult({date,times:null});});
    return ()=>controller.abort();
  },[date,time]);

  if (!date || !time) return {state:"unknown",times:[]};
  const times = result?.date === date ? result.times : undefined;
  if (!validSlot(date,time)) return {state:"clash",times:times??[]};
  if (times === undefined) return {state:"checking",times:[]};
  if (times === null) return {state:"unknown",times:[]};
  return {state:times.includes(time)?"available":"clash",times};
}

function AppointmentMark({check,lang}:{check:SlotCheck;lang:Lang}) {
  const text = {
    available:lang==="zh"?"✓ 可预约":"✓ Available",
    clash:lang==="zh"?"✕ 时段冲突":"✕ Clash",
    checking:lang==="zh"?"核对时段中…":"Checking availability…",
    unknown:lang==="zh"?"时段待核对":"Needs time check",
  }[check.state];
  return <span className={"email-tag email-slot-"+check.state}>{text}</span>;
}

function AppointmentRowStatus({message,lang}:{message:InboxMessage;lang:Lang}) {
  const {date,time} = emailAppointment(message);
  const clash = Boolean(date && time && !validSlot(date,time));
  return <span className={"email-tag"+(clash?" email-slot-clash":"")}>{clash
    ? (lang==="zh"?"✕ 时段冲突":"✕ Clash")
    : (lang==="zh"?"待确认":"Requested")}</span>;
}

function replyUrl(id:string,mode:"review" | "manual") {
  return "/admin/email/reply/"+encodeURIComponent(id)+"?mode="+mode;
}

function bookingHandoff(message:InboxMessage) {
  try {
    window.sessionStorage.setItem("harbour-email-booking",emailHandoff(message));
    return true;
  } catch {
    return false;
  }
}

function EmailComposer({message,lang,mode,onChange}: {
  message:InboxMessage; lang:Lang; mode:"review" | "manual";
  onChange:(patch:Partial<InboxMessage>)=>boolean;
}) {
  const t = (zh:string,en:string)=>lang==="zh"?zh:en;
  const check = useSlotCheck(message);
  const [body,setBody] = useState<string | null>(message.draft??null);
  const [status,setStatus] = useState("");
  const [template,setTemplate] = useState(message.category);
  const subject = /^re:/i.test(message.subject) ? message.subject : "Re: "+message.subject;
  const defaultBody = mode==="review" ? emailReplyDraft(message.category,message,lang,check) : "";
  const draft = body??defaultBody;

  function saveDraft() {
    setBody(draft);
    setStatus(onChange({draft})?t("草稿已保存到此标签页。","Draft saved in this tab."):t("无法保存到此标签页。","Draft could not be saved in this tab."));
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus(t("内容已复制。","Reply copied."));
    } catch {
      setStatus(t("无法访问剪贴板，请手动复制。","Clipboard access is unavailable. Copy the reply manually."));
    }
  }

  function downloadDraft() {
    const bytes = new TextEncoder().encode(subject);
    const subjectHeader = "=?UTF-8?B?"+btoa(String.fromCharCode(...bytes))+"?=";
    const eml = ["To: "+message.sender.replace(/[\r\n]/g,""),"Subject: "+subjectHeader,"MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8","Content-Transfer-Encoding: 8bit","",draft.replace(/\r?\n/g,"\r\n")].join("\r\n");
    const url = URL.createObjectURL(new Blob([eml],{type:"message/rfc822"}));
    const link = document.createElement("a");
    link.href=url;
    link.download="harbour-auto-draft.eml";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <section className="email-workspace email-compose">
    <a className="email-back" href="/admin/email"><ArrowLeft size={16}/>{t("返回收件箱","Back to inbox")}</a>
    <div className="email-title-row">
      <h1>{t("撰写回复","Compose reply")}</h1>
      {message.demo && <span className="email-tag">Demo</span>}
    </div>
    <div className="email-compose-frame">
      <p><strong>{t("收件人","To")}</strong> {message.sender}</p>
      <p><strong>{t("主题","Subject")}</strong> {subject}</p>
      {message.category==="appointment" && <AppointmentMark check={check} lang={lang}/>}
      <label className="email-field">
        <span>{t("回复内容","Reply")}</span>
        <textarea rows={12} value={draft} maxLength={8000} onChange={event=>{setBody(event.target.value);setStatus("");}}/>
      </label>
      <div className="email-compose-actions">
        <div className="email-actions">
          <button type="button" className="secondary" disabled={!draft&&!message.draft} onClick={()=>{
            setBody("");
            setStatus(onChange({draft:undefined})?t("草稿已删除。","Draft deleted."):t("无法更新此标签页中的草稿。","Draft could not be updated in this tab."));
          }}>{t("删除草稿","Delete draft")}</button>
          <button type="button" className="secondary" disabled={!draft.trim()} onClick={saveDraft}>{t("保存草稿","Save draft")}</button>
          <button type="button" className="primary" disabled title={t("需要连接邮箱","A mailbox connection is required")}>{t("发送邮件","Send email")}</button>
        </div>
        <div className="email-actions">
          <select aria-label={t("回复模板","Reply template")} value={template} onChange={event=>setTemplate(event.target.value as EmailCategory)}>
            {emailCategories.map(category=><option key={category} value={category}>{categoryLabels[category][lang==="zh"?0:1]}</option>)}
            <option value="quick-send" disabled>{t("快速发送 · 需连接邮箱","Quick send · mailbox required")}</option>
          </select>
          <button type="button" className="secondary" onClick={()=>{setBody(emailReplyDraft(template,message,lang,check));setStatus("");}}><Sparkles size={15}/>{t("生成模板","Generate reply")}</button>
        </div>
      </div>
      <div className="email-actions email-export">
        <button type="button" className="secondary" disabled={!draft.trim()} onClick={()=>void copyDraft()}>{t("复制回复","Copy reply")}</button>
        <button type="button" className="secondary" disabled={!draft.trim()} onClick={downloadDraft}><Download size={15}/>{t("下载草稿","Download draft")}</button>
      </div>
      <p className="email-help">{t("发送需要连接邮箱。可复制回复，或下载邮件草稿后使用你的邮箱。","Connect a mailbox to send here. Copy the reply or download the draft to use in your email app.")}</p>
      {status && <p role="status" className="email-help">{status}</p>}
    </div>
    <details className="email-original">
      <summary>{t("查看原始邮件","View original email")}</summary>
      <p>{message.body}</p>
    </details>
  </section>;
}

function EmailPreview({message,lang,onChange}:{
  message:InboxMessage;lang:Lang;onChange:(patch:Partial<InboxMessage>)=>boolean;
}) {
  const t = (zh:string,en:string)=>lang==="zh"?zh:en;
  const check = useSlotCheck(message);
  const [aiBusy,setAiBusy] = useState(false);
  const [status,setStatus] = useState("");

  async function summarize() {
    setAiBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin-email-summary",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({subject:message.subject,body:message.body,lang}),
      });
      const data = await response.json() as {summary?:string};
      if (!response.ok || !data.summary) throw new Error("Summary unavailable");
      if (!onChange({aiSummary:data.summary})) setStatus(t("摘要无法保存在此标签页。","The summary could not be saved in this tab."));
    } catch {
      setStatus(t("AI 摘要暂不可用，可继续查看原邮件。","AI summary is unavailable. The original email remains available."));
    } finally {
      setAiBusy(false);
    }
  }

  return <article className="email-preview">
    <div className="email-title-row"><h2>{message.subject}</h2>{message.demo&&<span className="email-tag">Demo</span>}</div>
    <p className="email-meta">{message.sender} · <time>{message.received}</time></p>
    <div className="email-actions">
      <span className="email-tag">{categoryLabels[message.category][lang==="zh"?0:1]}</span>
      {message.category==="appointment" && <AppointmentMark check={check} lang={lang}/>}
    </div>
    <p className="email-body">{message.body}</p>
    {message.aiSummary && <p className="email-generated-summary"><strong>{t("AI 摘要","AI summary")}</strong> {message.aiSummary}</p>}
    <p className="email-help">{t("生成 AI 摘要会将邮件主题及正文发送给 OpenAI。","Generating an AI summary sends the subject and message body to OpenAI.")}</p>
    <div className="email-actions">
      <button className="secondary" type="button" disabled={aiBusy} onClick={()=>void summarize()}><Sparkles size={15}/>{aiBusy?t("生成中…","Summarising…"):t("生成 AI 摘要","Summarise with AI")}</button>
      {message.category==="appointment" && <a className="secondary" href="/admin/appointments#request-appointment" onClick={event=>{
        if (!bookingHandoff(message)) {
          event.preventDefault();
          setStatus(t("无法转交邮件，请复制正文到预约页。","Could not transfer the email. Copy the message into Appointments."));
        }
      }}>{t("转到预约","Review in Appointments")}</a>}
      <a className="secondary" href={replyUrl(message.id,"manual")}>{t("手动回复","Respond manually")}</a>
    </div>
    {status && <p role="status" className="email-help">{status}</p>}
  </article>;
}

export function EmailWorkspace({lang,composeId}:{lang:Lang;composeId?:string}) {
  const t=(zh:string,en:string)=>lang==="zh"?zh:en;
  const [messages,setMessages] = useState<InboxMessage[]>([]);
  const [selected,setSelected] = useState<string>();
  const [filter,setFilter] = useState<"all"|EmailCategory>("all");
  const [showImport,setShowImport] = useState(false);
  const [mode,setMode] = useState<"review"|"manual">("manual");
  const [ready,setReady] = useState(false);
  const [status,setStatus] = useState("");
  const today = todaySydney();

  function commit(next:InboxMessage[]) {
    if (!writeAdminInbox(next)) {
      setStatus(t("无法保存到浏览器标签页。请检查存储空间后重试。","This tab could not save the inbox. Check browser storage and try again."));
      return false;
    }
    setMessages(next);
    return true;
  }

  function change(id:string,patch:Partial<InboxMessage>) {
    return commit(readAdminInbox().map(message=>message.id===id?{...message,...patch}:message));
  }

  useEffect(()=>{
    const next = readAdminInbox();
    if (composeId && next.some(message=>message.id===composeId&&!message.read)) {
      const updated = next.map(message=>message.id===composeId?{...message,read:true}:message);
      setMessages(writeAdminInbox(updated)?updated:next);
    } else {
      setMessages(next);
    }
    setMode(new URLSearchParams(window.location.search).get("mode")==="review"?"review":"manual");
    setReady(true);
  },[composeId]);

  function importEmail(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    const fields=new FormData(form);
    const sender=String(fields.get("sender")??"").trim();
    const subject=String(fields.get("subject")??"").trim();
    const body=String(fields.get("body")??"").trim();
    if (!sender || !subject || !body) {
      setStatus(t("请填写发件人、主题和邮件正文。","Enter a sender, subject and message body."));
      return;
    }
    const message = {
      sender,subject,body,received:String(fields.get("received")??today),
      id:crypto.randomUUID(),category:classifyEmail(subject,body),read:false,
    };
    const next = [message,...readAdminInbox()].sort((left,right)=>right.received.localeCompare(left.received));
    if (commit(next.slice(0,inboxLimit))) {
      form.reset();
      setShowImport(false);
      setSelected(next.indexOf(message)<inboxLimit?message.id:undefined);
      setFilter("all");
      setStatus(next.indexOf(message)<inboxLimit
        ? t("邮件已添加到此标签页。","Email added to this tab.")
        : t("此邮件早于最近 200 封，已超出收件箱范围。","This message falls outside the latest 200 emails."));
    }
  }

  function loadDemo() {
    const existing = readAdminInbox();
    const seen = new Set(existing.map(message=>message.id));
    const next = [...demoEmails().filter(message=>!seen.has(message.id)),...existing];
    next.sort((left,right)=>right.received.localeCompare(left.received));
    if (commit(next.slice(0,inboxLimit))) setStatus(t("演示邮件已加载。","Demo emails loaded."));
  }

  if (composeId) {
    const message = messages.find(entry=>entry.id===composeId);
    if (!ready) return <p>{t("正在加载邮件…","Loading email…")}</p>;
    if (!message) return <section className="email-workspace">
      <h1>{t("邮件已不可用","Email unavailable")}</h1>
      <p>{t("邮件和草稿保存在导入它们的浏览器标签页中。","Emails and drafts are kept in the tab where they were imported.")}</p>
      <a className="email-back" href="/admin/email"><ArrowLeft size={16}/>{t("返回收件箱","Back to inbox")}</a>
    </section>;
    return <EmailComposer key={message.id+mode} message={message} lang={lang} mode={mode} onChange={patch=>change(message.id,patch)}/>;
  }

  const shown = messages.filter(message=>filter==="all"||message.category===filter);
  const current = shown.find(message=>message.id===selected);
  return <section className="email-workspace">
    <div className="email-title-row">
      <div><h1>{t("邮件","Email")}</h1><p className="email-help">{t("收件箱保留最近 200 封邮件，可按需生成 AI 摘要。","The inbox shows the latest 200 emails. Generate AI summaries on demand.")}</p></div>
      <button type="button" className="primary" aria-expanded={showImport} onClick={()=>setShowImport(value=>!value)}><MailPlus size={16}/>{t("添加邮件","Add email")}</button>
    </div>
    {showImport && <form className="email-import" onSubmit={importEmail}>
      <h2>{t("导入邮件","Import an email")}</h2>
      <p className="email-help">{t("连接邮箱后才能同步和发送。现在可粘贴邮件，内容仅保存在此浏览器标签页。","Mailbox connection is required for sync and sending. For now, paste an email to keep it in this browser tab.")}</p>
      <div className="email-form-grid">
        <label className="email-field"><span>{t("发件人邮箱","Sender email")}</span><input name="sender" type="email" maxLength={180} required/></label>
        <label className="email-field"><span>{t("接收日期","Received date")}</span><input name="received" type="date" min="2000-01-01" max={today} defaultValue={today} required/></label>
      </div>
      <label className="email-field"><span>{t("主题","Subject")}</span><input name="subject" type="text" maxLength={180} required/></label>
      <label className="email-field"><span>{t("邮件正文","Message body")}</span><textarea name="body" rows={5} maxLength={6000} required/></label>
      <div className="email-actions"><button className="primary" type="submit">{t("导入收件箱","Import email")}</button>
        <button className="secondary" type="button" onClick={()=>setShowImport(false)}>{t("关闭","Close")}</button></div>
    </form>}
    <div className="email-toolbar">
      <label className="email-filter">{t("类型","Filter")} <select value={filter} onChange={event=>setFilter(event.target.value as "all"|EmailCategory)}>
        <option value="all">{t("全部邮件","All emails")}</option>
        {emailCategories.map(category=><option key={category} value={category}>{categoryLabels[category][lang==="zh"?0:1]}</option>)}
      </select></label>
      <button className="secondary" type="button" onClick={loadDemo}>{t("加载演示邮件","Load demo emails")}</button>
    </div>
    {status && <p role="status" className="email-help">{status}</p>}
    <div className={current?"email-inbox email-inbox--split":"email-inbox"}>
      <div className="email-list">
        {!ready && <p>{t("正在加载…","Loading…")}</p>}
        {ready && !shown.length && <div className="email-empty"><Inbox size={26}/><p>{t("暂无邮件","No email here yet")}</p></div>}
        {emailGroups.map(group=>{
          const entries = shown.filter(message=>groupEmail(message.received,today)===group);
          return entries.length>0 && <section className="email-group" key={group}>
            <h2>{groupLabels[group][lang==="zh"?0:1]}</h2>
            {entries.map(message=><article className={"email-row"+(message.read?"":" email-row--unread")+(selected===message.id?" email-row--selected":"")} key={message.id}>
              <button className="email-open" type="button" aria-pressed={selected===message.id} onClick={()=>{
                setSelected(message.id);
                if (!message.read) change(message.id,{read:true});
              }}>
                <span className="email-row-icon">{message.category!=="general"
                  ? <i className={message.read?"email-priority":"email-priority email-priority--unread"} role="img" aria-label={t("重要邮件","Important email")}/>
                  : <Mail size={15} aria-hidden="true"/>}</span>
                <span className="email-row-text">
                  <strong>{message.subject}{!message.read&&<span className="email-sr-only">{t("（未读）"," (unread)")}</span>}</strong>
                  <span className="email-line">{message.aiSummary? "AI · ":""}{emailSummary(message,lang)}</span>
                </span>
              </button>
              <span className="email-row-tags">
                {message.demo && <span className="email-tag">Demo</span>}
                {message.category==="appointment" && <AppointmentRowStatus message={message} lang={lang}/> }
                {!!message.draft && <span className="email-tag">{t("草稿","Draft")}</span>}
              </span>
              {message.category!=="general" && <details className="email-menu">
                <summary>{t("回复","Respond")}<ChevronDown size={14}/></summary>
                <div>
                  <button type="button" disabled title={t("需要连接邮箱","A mailbox connection is required")}><CircleAlert size={14}/>{t("发送自动回复","Send automated message")}</button>
                  <a href={replyUrl(message.id,"review")}>{t("核对自动回复","Review automated message")}</a>
                  <a href={replyUrl(message.id,"manual")}>{t("手动回复","Respond manually")}</a>
                </div>
              </details>}
            </article>)}
          </section>;
        })}
      </div>
      {current && <EmailPreview key={current.id} message={current} lang={lang} onChange={patch=>change(current.id,patch)}/>}
    </div>
  </section>;
}
