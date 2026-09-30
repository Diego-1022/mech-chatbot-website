import {env} from "cloudflare:workers";
import {z} from "zod";
import {database} from "@/db";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {services,times,validSlot,todaySydney} from "@/lib/catalog";
import {assistantReply} from "@/lib/assistant";
import {openaiReply,AIError} from "@/lib/openai-assistant";
export const dynamic="force-dynamic";
class Problem extends Error{constructor(public status:number,public code:string){super(code)}}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
const service=z.enum(services.map(s=>s.id) as [string,...string[]]);
const slot=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.enum(times as [string,...string[]])});
const fields=z.object({name:z.string().trim().min(1).max(80),email:z.string().trim().email().max(150),phone:z.string().trim().regex(/^[+\d ()-]{6,30}$/),vehicle:z.string().trim().min(2).max(120),service,notes:z.string().trim().max(1000).default("")});
const secret=z.string().regex(/^[a-f0-9]{64}$/);
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(n=>n.toString(16).padStart(2,"0")).join("");}
function valid(d:string,t:string){if(!validSlot(d,t))throw new Problem(400,"INVALID_SLOT");}
async function admin(){const user=await getChatGPTUser();const email=env.ADMIN_EMAIL||process.env.ADMIN_EMAIL;if(!user||!email||user.email.toLowerCase()!==email.trim().toLowerCase())throw new Problem(403,"ADMIN_REQUIRED");return user;}
async function rate(request:Request,kind:string,max:number){const ip=request.headers.get("cf-connecting-ip")||"local";const key=await hash(kind+":"+ip);const window=Math.floor(Date.now()/60000);const r=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key,window).first<{hits:number}>();if((r?.hits||0)>max)throw new Problem(429,"RATE_LIMIT");}
async function own(request:Request,id:string){const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";if(!secret.safeParse(token).success)throw new Problem(404,"NOT_FOUND");const row=await database().prepare("SELECT * FROM bookings WHERE id=? AND token_hash=? AND status!='blocked'").bind(id,await hash(token)).first<Record<string,any>>();if(!row)throw new Problem(404,"NOT_FOUND");return row;}
function clean(row:Record<string,any>){const {token_hash,...safe}=row;return safe;}
async function run(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof Problem)return reply({error:e.code},e.status);if(e instanceof z.ZodError)return reply({error:"INVALID_INPUT"},400);console.error(e instanceof Error?e.message:"Request failed");if(String(e).includes("UNIQUE constraint failed: bookings.date"))return reply({error:"SLOT_TAKEN"},409);return reply({error:"UNAVAILABLE"},503);}}
export async function GET(request:Request){return run(async()=>{const url=new URL(request.url);const action=url.searchParams.get("action");
 if(action==="availability"){const date=url.searchParams.get("date")||"";if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Problem(400,"INVALID_INPUT");const {results}=await database().prepare("SELECT time FROM bookings WHERE date=? AND status IN ('confirmed','blocked')").bind(date).all<{time:string}>();return reply({times:times.filter(t=>validSlot(date,t)&&!results.some(r=>r.time===t))});}
 if(action==="booking"){await rate(request,"lookup",30);return reply({booking:clean(await own(request,url.searchParams.get("id")||""))});}
 if(action==="admin"){await admin();const date=url.searchParams.get("date")||todaySydney();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Problem(400,"INVALID_INPUT");const {results}=await database().prepare("SELECT id,name,email,phone,vehicle,service,date,time,notes,status,created_at FROM bookings WHERE date=? ORDER BY time").bind(date).all();return reply({bookings:results});}
 return reply({mode:(env.OPENAI_API_KEY||process.env.OPENAI_API_KEY)?"ai":"rules",timezone:"Australia/Sydney"});});}
export async function POST(request:Request){return run(async()=>{
 if(request.headers.get("sec-fetch-site")==="cross-site"||request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)throw new Problem(403,"BAD_ORIGIN");
 if(!request.headers.get("content-type")?.includes("application/json"))throw new Problem(400,"INVALID_INPUT");
 const raw=await request.text();if(raw.length>24000)throw new Problem(413,"INVALID_INPUT");let b:any;try{b=JSON.parse(raw)}catch{throw new Problem(400,"INVALID_INPUT")}
 if(!b||typeof b!=="object")throw new Problem(400,"INVALID_INPUT");
 if(b.action==="create"){await rate(request,"create",12);const d=fields.merge(slot).extend({requestId:z.string().uuid(),token:secret}).parse(b);valid(d.date,d.time);const tokenHash=await hash(d.token);const existing=await database().prepare("SELECT * FROM bookings WHERE id=?").bind(d.requestId).first<Record<string,any>>();if(existing){if(existing.token_hash!==tokenHash)throw new Problem(409,"INVALID_INPUT");return reply({booking:clean(existing)});}
 await database().prepare("INSERT INTO bookings(id,token_hash,name,email,phone,vehicle,service,date,time,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'confirmed',?)").bind(d.requestId,tokenHash,d.name,d.email,d.phone,d.vehicle,d.service,d.date,d.time,d.notes,new Date().toISOString()).run();const row=await database().prepare("SELECT * FROM bookings WHERE id=?").bind(d.requestId).first<Record<string,any>>();return reply({booking:clean(row!)},201);}
 if(b.action==="cancel"||b.action==="reschedule"){await rate(request,"manage",20);const row=await own(request,z.string().uuid().parse(b.id));if(row.status!=="confirmed")throw new Problem(409,"NOT_ACTIVE");
 if(b.action==="cancel"){const result=await database().prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'").bind(row.id).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");}
 else{const d=slot.parse(b);valid(d.date,d.time);const result=await database().prepare("UPDATE bookings SET date=?,time=? WHERE id=? AND status='confirmed'").bind(d.date,d.time,row.id).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");}return reply({ok:true});}
 if(b.action==="adminStatus"){await admin();const d=z.object({id:z.string().uuid(),status:z.enum(["cancelled","completed"])}).parse(b);const result=await database().prepare("UPDATE bookings SET status=? WHERE id=? AND status IN ('confirmed','blocked')").bind(d.status,d.id).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");return reply({ok:true});}
 if(b.action==="block"){await admin();const d=slot.parse(b);valid(d.date,d.time);await database().prepare("INSERT INTO bookings(id,token_hash,name,email,phone,vehicle,service,date,time,notes,status,created_at) VALUES(?,'','','','','','',?,?,'','blocked',?)").bind(crypto.randomUUID(),d.date,d.time,new Date().toISOString()).run();return reply({ok:true});}

 if(b.action==="chat"){
  await rate(request,"chat",12);
  const turn=z.object({role:z.enum(["user","assistant"]),content:z.string().max(4500)});
  const d=z.object({message:z.string().trim().min(1).max(1500),lang:z.enum(["zh","en"]),history:z.array(z.union([z.string().max(1500),turn])).max(8).default([])}).parse(b);
  const history=d.history.map(h=>typeof h==="string"?{role:"user" as const,content:h}:h);
  if(history.reduce((n,h)=>n+h.content.length,0)>16000)throw new Problem(400,"INVALID_INPUT");
  const key=env.OPENAI_API_KEY||process.env.OPENAI_API_KEY;
  const fallback=(reason:string)=>({...assistantReply(d.message,d.lang,history.filter(h=>h.role==="user").map(h=>h.content)),mode:"rules",reason});
  if(!key)return reply(fallback("not_configured"));
  const rawLimit=Number(env.AI_DAILY_REQUEST_LIMIT||"200");const limit=Number.isFinite(rawLimit)&&rawLimit>=1?Math.min(Math.floor(rawLimit),1000):200;
  const window=Math.floor(Date.now()/86400000);
  const used=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES('__ai_daily',?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(window).first<{hits:number}>();
  if((used?.hits||0)>limit)return reply(fallback("daily_limit"));
  try{return reply(await openaiReply(key,d.message,d.lang,history));}
  catch(e){console.warn("OpenAI request unavailable",e instanceof AIError?e.code:"AI_UNAVAILABLE");return reply(fallback("temporarily_unavailable"));}
 }
 throw new Problem(400,"INVALID_INPUT");});}
