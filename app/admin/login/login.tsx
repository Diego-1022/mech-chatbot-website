"use client";
import {useState,useEffect} from "react";
import {useLanguage} from "@/lib/client";
export default function Login(){
 const [lang,setLang]=useLanguage();const t=(zh:string,en:string)=>lang==="zh"?zh:en;
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/admin-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});if(r.ok){window.location.assign("/admin");return;}setError(r.status===429?t("尝试次数过多，请 15 分钟后重试。","Too many attempts. Try again in 15 minutes."):r.status===401?t("密码不正确。","That password is incorrect."):t("暂时无法登录，请检查管理员设置。","Sign-in is unavailable. Check the administrator setup."));}catch{setError(t("连接失败，请重试。","Unable to connect. Please try again."));}finally{setBusy(false);}}
 return <><header className="header"><a className="brand" href="/">HARBOUR AUTO</a><nav><button aria-label="Switch language" onClick={()=>setLang(lang==="en"?"zh":"en")}>{lang==="en"?"中文":"English"}</button></nav></header><main className="screen" style={{maxWidth:520}}><p className="eyebrow">WORKSHOP ADMIN</p><h1 style={{fontSize:"2.6rem"}}>{t("管理员登录","Administrator sign-in")}</h1><form className="panel" method="post" action="/api/admin-session" onSubmit={submit}><label className="field">{t("管理员密码","Administrator password")}<input disabled={!ready} name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary full" disabled={busy||!ready}>{busy?t("正在登录…","Signing in…"):t("登录","Sign in")}</button>{error&&<p role="alert" className="error">{error}</p>}<p className="small muted" style={{marginTop:18}}>{t("仅供店铺管理员使用。客户预约无需登录。","For the workshop administrator. Customers can book without signing in.")}</p></form><a className="link" href="/">{t("返回首页","Back to home")}</a></main></>;
}

