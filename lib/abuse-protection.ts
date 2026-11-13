import {env} from "cloudflare:workers";
import {database} from "@/db";
import {AccountProblem,digest} from "./customer-session";

export const emailVerificationEnabled=()=>env.EMAIL_VERIFICATION_ENABLED==="true";
export function publicProtection(){return {turnstileSiteKey:env.TURNSTILE_SITE_KEY||null,turnstileRequired:env.TURNSTILE_REQUIRED==="true",emailVerificationEnabled:emailVerificationEnabled()};}
export async function verifyHuman(request:Request,token:unknown,action:string){
  if(env.TURNSTILE_REQUIRED!=="true")return;
  if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY)throw new AccountProblem("PROTECTION_UNAVAILABLE",503);
  if(typeof token!=="string"||!token||token.length>2048)throw new AccountProblem("HUMAN_REQUIRED",403);
  let result:{success?:boolean;hostname?:string;action?:string};
  try{
    const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get("cf-connecting-ip")||undefined}),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error();result=await response.json();
  }catch{throw new AccountProblem("PROTECTION_UNAVAILABLE",503)}
  if(!result.success||result.hostname!==new URL(request.url).hostname||result.action!==action)throw new AccountProblem("HUMAN_REQUIRED",403);
}
// Each key has one atomic counter: concurrent requests and changing accounts do not reset it.
export async function budget(subject:string,kind:string,maximum:number,period=86400000){
  const key=await digest(`protection:${kind}:${subject}`),window=Math.floor(Date.now()/period);
  const row=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key,window).first<{hits:number}>();
  if(!row)throw new AccountProblem("UNAVAILABLE",503);
  return row.hits<=maximum;
}
export async function paidChatAllowed(request:Request,customerId?:string){
  const ip=request.headers.get("cf-connecting-ip")||"local";
  // Guests: 5/day/IP. Accounts: 20/day/account. All accounts on an IP share 30/day.
  if(!await budget(ip,"ai-ip",30))return false;
  return customerId?budget(customerId,"ai-account",20):budget(ip,"ai-guest",5);
}

// Chat and finance analysis share the configured workshop-wide AI allowance.
export async function paidAIAllowed() {
  const rawLimit=Number(env.AI_DAILY_REQUEST_LIMIT??"50");
  const limit=Number.isFinite(rawLimit)&&rawLimit>=0?Math.min(Math.floor(rawLimit),1000):50;
  if(!limit)return false;
  const window=Math.floor(Date.now()/86400000);
  const row=await database().prepare(
    "INSERT INTO rate_limits(key,window,hits) VALUES('__ai_daily',?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits",
  ).bind(window).first<{hits:number}>();
  if(!row)throw new AccountProblem("UNAVAILABLE",503);
  return row.hits<=limit;
}
