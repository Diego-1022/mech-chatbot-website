"use client";
import {bookingIntent,extractBooking,type BookingDraft} from "@/lib/conversation-booking";
import {HumanCheck,type Protection} from "./human-check";
import {useState,useRef,useEffect} from "react";
import {Send,MessageCircle,ImagePlus} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Lang,serviceName} from "@/lib/catalog";import {api,errorText} from "@/lib/client";import Booking from "./booking";
import {PhotoSelection,type SelectedPhoto} from "./booking-photos";
import {prepareChatImage} from "@/lib/prepare-chat-images";
import {imageDisclaimer,type ChatImage} from "@/lib/chat-images";
type Message={localBooking?:boolean;role:"user"|"assistant";text:string;service?:string;book?:boolean;mode?:string;reason?:string;images?:ChatImage[];imageCount?:number;imageAnalysis?:string;estimate?:{min:number;max:number;currency:string;service:string}|null};
export default function Chat({open,setOpen,lang}:{open:boolean,setOpen:(v:boolean)=>void,lang:Lang}){
 const t=(z:string,e:string)=>lang==="zh"?z:e;
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[booking,setBooking]=useState<string|null>(null),[mode,setMode]=useState("loading"),[historyLoading,setHistoryLoading]=useState(false),[signedIn,setSignedIn]=useState(false),[historyWarning,setHistoryWarning]=useState(false);
 const [protection,setProtection]=useState<Protection>(),[humanToken,setHumanToken]=useState(""),[humanReset,setHumanReset]=useState(0);
 const draft=useRef<BookingDraft>({}),bookingActive=useRef(false),bookingCompleted=useRef(false),bookingPhotos=useRef<SelectedPhoto[]>([]);
 const customerId=useRef<string|null>(null);
 const [photos,setPhotos]=useState<SelectedPhoto[]>([]),[showPhotos,setShowPhotos]=useState(false),[checkingPhotos,setCheckingPhotos]=useState(false);
 const sending=useRef(false);
 const end=useRef<HTMLDivElement>(null),photoPanel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(showPhotos)photoPanel.current?.scrollIntoView({behavior:"smooth",block:"start"})},[showPhotos]);
 useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,busy]);
 useEffect(()=>{
  if(!open||busy)return;
  let cancelled=false;setHistoryLoading(true);
  fetch("/api/workshop").then(r=>r.json()).then((b:any)=>{if(!cancelled)setMode(b.mode==="ai"?"ai":"rules")}).catch(()=>{});
  fetch("/api/account").then(async r=>{if(!r.ok)throw new Error();return r.json() as Promise<{user:{id:string}|null;history:Message[];protection:Protection}>}).then(b=>{
   if(cancelled)return;setProtection(b.protection);
   if(customerId.current!==(b.user?.id||null)){bookingPhotos.current=[];setPhotos([]);setShowPhotos(false);draft.current={};bookingActive.current=false;setBooking(null)}
   if(b.user){setMessages(b.history);setSignedIn(true)}else{if(customerId.current)setMessages([]);setSignedIn(false)}
   customerId.current=b.user?.id||null;setHistoryWarning(false);
  }).catch(()=>{if(!cancelled)setError("UNAVAILABLE")}).finally(()=>{if(!cancelled)setHistoryLoading(false)});
  return()=>{cancelled=true};
 },[open]);
 async function send(value:string){
  if((!value.trim()&&!photos.length)||sending.current||historyLoading||checkingPhotos)return;
  sending.current=true;setBusy(true);setError("");let appended=false;
  const text=value.trim()||t("请分析这些车辆照片，并给出下一步建议和适用的参考费用。","Please assess these vehicle photos and suggest the next step and any applicable indicative costs.");
  const history=messages.filter(m=>!m.localBooking).slice(-4).map(m=>({role:m.role,content:(m.text+(m.imageCount?` [${m.imageCount} photos were attached; originals are not available in history.]`:"")).slice(0,2200)}));
  const extracted=extractBooking(text,draft.current).draft;
  if(!extracted.notes){const symptoms=messages.filter(m=>m.role==="user"&&!m.localBooking&&/noise|squeak|vibrat|warning|brake|overheat|start/i.test(m.text)&&/^[\x20-\x7e\r\n\t]*$/.test(m.text)&&!/@|(?:\d[ ()-]*){8}/.test(m.text)).slice(-3).map(m=>m.text).join("; ");if(symptoms)extracted.notes=symptoms.slice(0,1000);}
  const preparing=bookingActive.current||bookingIntent(text)||!!(extracted.date&&extracted.time);
  try{
   const images:ChatImage[]=[];if(!preparing)for(const photo of photos)images.push(await prepareChatImage(photo.file));
   setMessages(m=>[...m.slice(-59).map((message,i,all)=>i<all.length-3?{...message,images:undefined}:message),{role:"user",text,images,imageCount:images.length,localBooking:preparing}]);appended=true;setInput("");setShowPhotos(false);
   const payload={message:text,lang,history,customerId:customerId.current,humanToken};
   let data: {reply:string;mode:string;service?:string;book?:boolean;reason?:string;estimate?:Message["estimate"];imageAnalysis?:string;signedIn?:boolean;historySaved?:boolean;error?:string;bookingDraft?:BookingDraft;bookingReady?:boolean};
   if(preparing){
    if(photos.length)bookingPhotos.current=photos;
    data=await api("prepareBooking",{...payload,draft:extracted});
    if(data.bookingDraft){draft.current=data.bookingDraft;bookingActive.current=true;}
    if(data.bookingReady&&data.bookingDraft?.service)setBooking(data.bookingDraft.service);
   }else if(images.length){
    const response=await fetch("/api/workshop",{method:"POST",headers:{"Content-Type":"application/json","X-Chat-Images":"1"},body:JSON.stringify({action:"chat",...payload,images})});
    data=await response.json() as typeof data;if(!response.ok)throw new Error(data.error||"UNAVAILABLE");
   }else data=await api("chat",payload);
   if(!preparing){draft.current=extracted;if(data.service)draft.current.service=data.service;}
   setMode(data.mode);setHistoryWarning(!!data.signedIn&&!data.historySaved);
   setMessages(m=>[...m,{role:"assistant",localBooking:preparing,text:data.reply,service:data.service,book:data.book,mode:data.mode,reason:data.reason,estimate:data.estimate,imageAnalysis:data.imageAnalysis}]);
   if(data.imageAnalysis==="unavailable"){setInput(value)}else setPhotos([]);
  }catch(e){setError((e as Error).message);setInput(value);if(appended)setMessages(m=>m.slice(0,-1));if(photos.length)setShowPhotos(true)}
  finally{setHumanToken("");setHumanReset(v=>v+1);sending.current=false;setBusy(false)}
 }
 return <><button className="chat-launch" onClick={()=>setOpen(true)}><MessageCircle size={21}/>{t("咨询与预约","Ask & book")}</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="chat-dialog sm:max-w-lg">
 <div className="chat-head"><DialogTitle>{booking?t("安排预约","Book a visit"):t("Harbour 咨询助手","Harbour assistant")}</DialogTitle><DialogDescription className="mt-1 text-sm">{mode==="ai"?t("OpenAI 智能助手 · 初步建议，不代替现场检查","Powered by OpenAI · guidance, not a confirmed diagnosis"):mode==="guide"?t("店铺指南 · 标准服务资料，本次无需调用 AI","Workshop guide · standard information, no AI call needed"):mode==="rules"?t("基础规则助手 · 本次未使用 AI 模型","Basic rule guidance · AI is not active for this reply"):t("车辆咨询与预约","Car care & appointments")}</DialogDescription></div>
 {booking?<div className="chat-messages chat-booking" style={{display:"block"}}><button className="link" style={{marginBottom:18}} onClick={()=>{setBooking(null);if(bookingCompleted.current){draft.current={};bookingPhotos.current=[];bookingActive.current=false;bookingCompleted.current=false;setMessages([])}}}>{t("返回对话","Back to chat")}</button><Booking key={JSON.stringify(draft.current)} lang={lang} initialService={booking} initialDraft={draft.current} initialPhotos={bookingPhotos.current} expectedCustomerId={customerId.current} onDone={()=>{bookingCompleted.current=true}}/></div>:
 <div className="chat-messages" aria-live="polite"><div className="bubble">{t("你好，我可以介绍服务、参考费用和营业时间，也能帮你安排到店预约。请描述车辆症状，或选择下面的问题。","Hello. I can explain services, indicative estimates and opening hours, and help you book a visit. Describe a symptom or choose a question below.")}</div>
 <p className="small muted">{t("咨询文字及发送的图片可能交由 OpenAI 处理。开始预约后可提供必要联系方式，这部分会直接用于预约，不发给 AI。","Questions and submitted images may be processed by OpenAI. Once booking starts, required contact details go directly to the booking helper, not the AI.")}</p>
 <p className="chat-account-note">{historyLoading?t("正在读取对话…","Loading conversation…"):signedIn?t("已登录 · 对话会保存到你的账户","Signed in · conversations are saved to your account"):<a href="/account">{t("登录以保存咨询记录","Sign in to save your conversations")}</a>}</p>
 {historyWarning&&<p className="error" role="status">{t("本次回复已显示，但账户记录暂未保存。","Your reply is displayed, but account history could not be saved.")}</p>}
 <button className="link" disabled={busy||historyLoading} onClick={()=>{draft.current={};bookingPhotos.current=[];bookingActive.current=false;setBooking(null);setMessages([]);setInput("");setError("")}}>{t("重新开始咨询／预约","Start a new enquiry / booking")}</button><div className="quick">{[t("保养多少钱？","Service prices?"),t("刹车有异响","Brake noise"),t("营业时间","Opening hours"),t("我要预约","Book a visit")].map(q=><button disabled={busy||historyLoading||checkingPhotos||photos.length>0} key={q} onClick={()=>send(q)}>{q}</button>)}</div>
 {messages.map((m,i)=><div key={i} className={"bubble "+(m.role==="user"?"user":"")}>
 {m.mode==="rules"&&<p className="small" style={{fontWeight:700,marginBottom:8}}>{m.reason==="personal_limit"?t("本账户或网络今日 AI 额度已用完，以下为基础建议；明日 UTC 00:00 重置。","This account or network has reached its daily AI allowance. Basic guidance follows; resets at 00:00 UTC."):m.reason==="daily_limit"?t("今日 AI 用量已达上限，以下是基础规则建议。","Today's AI request limit has been reached. Basic guidance follows."):t("AI 暂不可用，以下是基础规则建议。","AI is unavailable. Basic guidance follows.")}</p>}
 {m.images?.length?<div className="chat-photo-thumbnails">{m.images.map((image,j)=><img key={j} src={image.dataUrl} alt={t("已发送的车辆照片 ","Submitted vehicle photo ")+(j+1)}/>)}</div>:m.imageCount?<p className="small muted">{t(`此消息附有 ${m.imageCount} 张图片；历史记录仅保留文字。`,`This message included ${m.imageCount} photo(s); history retains text only.`)}</p>:null}
 {m.text}
 {m.estimate&&<div className="notice"><strong>{serviceName(m.estimate.service,lang)} · A$ {m.estimate.min}–{m.estimate.max}</strong><p className="small">{t("参考价格区间。检查后确认项目、零件与人工；诊断费用不包含后续维修。","Indicative catalogue range. Scope, parts and labour require inspection; diagnosis excludes subsequent repairs.")}</p></div>}
 {m.imageAnalysis&&<p className="chat-ai-disclaimer"><strong>{t("AI 图片分析免责声明","AI photo analysis disclaimer")}</strong>{imageDisclaimer[lang]}</p>}
 {m.service&&!m.localBooking&&<button className="primary full" style={{marginTop:14}} onClick={()=>{draft.current.service=m.service!;bookingActive.current=true;void send(t("我要预约","I would like to book"))}}>{t("安排预约","Book a visit")}</button>}</div>)}
 {busy&&<p className="muted" role="status">{photos.length?t("正在准备并分析图片…","Preparing and analysing photos…"):t("正在回复…","Replying…")}</p>}{error&&<p className="error" role="alert">{errorText(error,lang)}</p>}{showPhotos&&<div className="chat-photo-picker" ref={photoPanel}><PhotoSelection context="chat" photos={photos} onChange={setPhotos} onCheckingChange={setCheckingPhotos} lang={lang} disabled={busy||historyLoading}/><p className="chat-ai-disclaimer">{imageDisclaimer[lang]}</p></div>}<HumanCheck config={protection} action="chat" lang={lang} reset={humanReset} onToken={setHumanToken}/><p className="small muted">{t("AI 咨询设有账户及网络共享额度，切换账户不会重置网络额度。","AI consultation has account and shared network limits. Switching accounts does not reset the network allowance.")}</p><div ref={end}/></div>}
 {!booking&&<form className="chat-input chat-image-input" onSubmit={e=>{e.preventDefault();send(input)}}><button type="button" className="chat-attach" aria-expanded={showPhotos} disabled={busy||historyLoading||checkingPhotos} aria-label={t("添加车辆照片","Attach vehicle photos")} onClick={()=>setShowPhotos(v=>!v)}><ImagePlus size={20}/>{photos.length>0&&<span>{photos.length}</span>}</button><input className="input" aria-label={t("输入问题","Your question")} value={input} maxLength={1500} onChange={e=>setInput(e.target.value)} placeholder={t("描述症状或询问服务…","Ask about your car…")}/><button disabled={busy||historyLoading||checkingPhotos||(!input.trim()&&!photos.length)} className="primary" aria-label={t("发送","Send")}><Send size={19}/></button></form>}
 </DialogContent></Dialog></>;
}

