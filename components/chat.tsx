"use client";
import {useState,useRef,useEffect} from "react";
import {Send,MessageCircle} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Lang,serviceName} from "@/lib/catalog";import {api,errorText} from "@/lib/client";import Booking from "./booking";
type Message={role:"user"|"assistant";text:string;service?:string;book?:boolean;mode?:string;reason?:string;estimate?:{min:number;max:number;currency:string;service:string}|null};
export default function Chat({open,setOpen,lang}:{open:boolean,setOpen:(v:boolean)=>void,lang:Lang}){
 const t=(z:string,e:string)=>lang==="zh"?z:e;
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[booking,setBooking]=useState<string|null>(null),[mode,setMode]=useState("loading");
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,busy]);
 useEffect(()=>{if(open)fetch("/api/workshop").then(r=>r.json()).then((b:any)=>setMode(b.mode==="ai"?"ai":"rules")).catch(()=>setMode("unknown"));},[open]);
 async function send(value:string){if(!value.trim()||busy)return;
 const history=messages.slice(-4).map(m=>({role:m.role,content:m.text.slice(0,2200)}));
 setMessages(m=>[...m,{role:"user",text:value}]);setInput("");setBusy(true);setError("");
 try{const data=await api("chat",{message:value,lang,history});setMode(data.mode);setMessages(m=>[...m,{role:"assistant",text:data.reply,service:data.service,book:data.book,mode:data.mode,reason:data.reason,estimate:data.estimate}]);}
 catch(e){setError((e as Error).message);setInput(value);setMessages(m=>m.slice(0,-1));}finally{setBusy(false)}}
 return <><button className="chat-launch" onClick={()=>setOpen(true)}><MessageCircle size={21}/>{t("咨询与预约","Ask & book")}</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="chat-dialog sm:max-w-lg">
 <div className="chat-head"><DialogTitle>{booking?t("安排预约","Book a visit"):t("Harbour 咨询助手","Harbour assistant")}</DialogTitle><DialogDescription className="mt-1 text-sm">{mode==="ai"?t("OpenAI 智能助手 · 初步建议，不代替现场检查","Powered by OpenAI · guidance, not a confirmed diagnosis"):mode==="guide"?t("店铺指南 · 标准服务资料，本次无需调用 AI","Workshop guide · standard information, no AI call needed"):mode==="rules"?t("基础规则助手 · 本次未使用 AI 模型","Basic rule guidance · AI is not active for this reply"):t("车辆咨询与预约","Car care & appointments")}</DialogDescription></div>
 {booking?<div className="chat-messages" style={{display:"block"}}><button className="link" style={{marginBottom:18}} onClick={()=>setBooking(null)}>{t("返回对话","Back to chat")}</button><Booking lang={lang} initialService={booking}/></div>:
 <div className="chat-messages" aria-live="polite"><div className="bubble">{t("你好，我可以介绍服务、参考费用和营业时间，也能帮你安排到店预约。请描述车辆症状，或选择下面的问题。","Hello. I can explain services, demo estimates and opening hours, and help you book a visit. Describe a symptom or choose a question below.")}</div>
 <p className="small muted">{t("咨询文字将发送给 OpenAI 处理。请勿在对话中填写联系方式；预约资料请在表单中填写。","Chat messages are sent to OpenAI. Keep contact details out of chat; enter booking details in the form.")}</p>
 <div className="quick">{[t("保养多少钱？","Service prices?"),t("刹车有异响","Brake noise"),t("营业时间","Opening hours"),t("我要预约","Book a visit")].map(q=><button disabled={busy} key={q} onClick={()=>send(q)}>{q}</button>)}</div>
 {messages.map((m,i)=><div key={i} className={"bubble "+(m.role==="user"?"user":"")}>
 {m.mode==="rules"&&<p className="small" style={{fontWeight:700,marginBottom:8}}>{m.reason==="daily_limit"?t("今日 AI 用量已达上限，以下是基础规则建议。","Today's AI request limit has been reached. Basic guidance follows."):t("AI 暂不可用，以下是基础规则建议。","AI is unavailable. Basic guidance follows.")}</p>}
 {m.text}
 {m.estimate&&<div className="notice"><strong>{serviceName(m.estimate.service,lang)} · A$ {m.estimate.min}–{m.estimate.max}</strong><p className="small">{t("演示价目表区间，不是实际维修报价。检查后确认项目、零件与人工；诊断费用不包含后续维修。","Demo catalogue range, not a repair quote. Scope, parts and labour require inspection; diagnosis excludes subsequent repairs.")}</p></div>}
 {m.service&&<button className="primary full" style={{marginTop:14}} onClick={()=>setBooking(m.service!)}>{t("安排预约","Book a visit")}</button>}</div>)}
 {busy&&<p className="muted" role="status">{t("正在回复…","Replying…")}</p>}{error&&<p className="error" role="alert">{errorText(error,lang)}</p>}<div ref={end}/></div>}
 {!booking&&<form className="chat-input" onSubmit={e=>{e.preventDefault();send(input)}}><input className="input" aria-label={t("输入问题","Your question")} value={input} maxLength={1500} onChange={e=>setInput(e.target.value)} placeholder={t("描述症状或询问服务…","Ask about your car…")}/><button disabled={busy||!input.trim()} className="primary" aria-label={t("发送","Send")}><Send size={19}/></button></form>}
 </DialogContent></Dialog></>;
}

