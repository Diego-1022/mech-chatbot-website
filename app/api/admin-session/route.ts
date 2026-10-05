import {env} from "cloudflare:workers";
import {database} from "@/db";
import {standalone} from "@/lib/deployment";
import {createSession,passwordMatches,sessionCookie} from "@/lib/admin-session";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request) {
  if(!standalone)return json({error:"NOT_FOUND"},404);
  const url=new URL(request.url);
  if(request.headers.get("origin")!==url.origin || request.headers.get("sec-fetch-site")==="cross-site")return json({error:"BAD_ORIGIN"},403);
  try {
    const raw=await request.text();if(raw.length>2048)return json({error:"INVALID_INPUT"},400);
    const type=request.headers.get("content-type")||"";
    const data=type.includes("application/json")?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
    if(data.action==="logout")return new Response(null,{status:303,headers:{Location:"/admin/login","Set-Cookie":sessionCookie("",url.protocol==="https:",0),"Cache-Control":"no-store"}});
    if(typeof data.password!=="string")return json({error:"INVALID_INPUT"},400);
    if(!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET || !env.ADMIN_EMAIL || env.ADMIN_PASSWORD.length<20 || env.ADMIN_SESSION_SECRET.length<32)return json({error:"NOT_CONFIGURED"},503);
    const ip=request.headers.get("cf-connecting-ip")||"local";
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
    const key="admin-login:"+[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
    const window=Math.floor(Date.now()/900000);
    const count=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key,window).first<{hits:number}>();
    if((count?.hits||0)>5)return json({error:"RATE_LIMIT"},429);
    if(!await passwordMatches(data.password,env.ADMIN_PASSWORD))return json({error:"INVALID_PASSWORD"},401);
    const token=await createSession(env.ADMIN_SESSION_SECRET);
    return Response.json({ok:true},{headers:{"Set-Cookie":sessionCookie(token,url.protocol==="https:"),"Cache-Control":"no-store"}});
  } catch {return json({error:"UNAVAILABLE"},503);}
}
