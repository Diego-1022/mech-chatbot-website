"use client";
import {useEffect,useRef,useState} from "react";
import type {Lang} from "@/lib/catalog";
type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global {interface Window {turnstile?:Turnstile}}
export type Protection={turnstileSiteKey:string|null;turnstileRequired:boolean;emailVerificationEnabled:boolean};
let scriptPromise:Promise<void>|undefined;
function loadScript(){
  if(window.turnstile)return Promise.resolve();
  if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
    script.onload=()=>{if(window.turnstile)resolve();else{script.remove();scriptPromise=undefined;reject(new Error("HUMAN_REQUIRED"))}};script.onerror=()=>{script.remove();scriptPromise=undefined;reject(new Error("HUMAN_REQUIRED"))};document.head.appendChild(script);
  });return scriptPromise;
}
export function HumanCheck({config,action,lang,reset,onToken}:{config?:Protection;action:string;lang:Lang;reset:number;onToken:(token:string)=>void}){
  const container=useRef<HTMLDivElement>(null),callback=useRef(onToken);
  useEffect(()=>{callback.current=onToken},[onToken]);
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    callback.current("");
    if(!config?.turnstileRequired)return;
    if(!config.turnstileSiteKey)return;
    let cancelled=false,id:string|undefined;
    loadScript().then(()=>{if(cancelled||!container.current)return;setFailed(false);id=window.turnstile?.render(container.current,{sitekey:config.turnstileSiteKey,action,theme:"dark",size:"flexible",language:lang==="zh"?"zh-cn":"en",callback:(token:string)=>callback.current(token),"expired-callback":()=>callback.current(""),"error-callback":()=>{callback.current("");setFailed(true)}})}).catch(()=>{if(!cancelled)setFailed(true)});
    return()=>{cancelled=true;if(id)window.turnstile?.remove(id)};
  },[config?.turnstileRequired,config?.turnstileSiteKey,action,lang,reset,retry]);
  if(!config?.turnstileRequired)return null;
  return <div className="human-check"><div ref={container}/>{(failed||!config.turnstileSiteKey)&&<p role="alert">{lang==="zh"?"人机验证暂不可用。":"Human verification is unavailable."} <button type="button" className="link" onClick={()=>setRetry(v=>v+1)}>{lang==="zh"?"重试":"Retry"}</button></p>}</div>;
}
