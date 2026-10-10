import {pbkdf2, randomBytes, timingSafeEqual} from "node:crypto";
import {database} from "@/db";

const COOKIE = "harbour_customer";
const DAYS = 7 * 86400;
const ITERATIONS = 600000;
export type Customer = {id:string;name:string;email:string};
export class AccountProblem extends Error {
  constructor(public code:string, public status=400) {super(code);}
}
export async function digest(value:string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,"0")).join("");
}
function derive(password:string,salt:string) {
  return new Promise<Buffer>((resolve,reject)=>pbkdf2(password,salt,ITERATIONS,32,"sha256",(error,key)=>error?reject(error):resolve(key)));
}
export async function passwordHash(password:string) {
  const salt=randomBytes(16).toString("hex");
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${(await derive(password,salt)).toString("hex")}`;
}
export async function passwordMatches(password:string,stored:string) {
  const [algorithm,rounds,salt,hash]=stored.split("$");
  if(algorithm!=="pbkdf2-sha256"||rounds!==String(ITERATIONS)||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(hash))return false;
  return timingSafeEqual(await derive(password,salt),Buffer.from(hash,"hex"));
}
export function customerToken(request:Request) {
  const token=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||"";
  return /^[a-f0-9]{64}$/.test(token)?token:"";
}
export async function currentCustomer(request:Request):Promise<Customer|null> {
  const token=customerToken(request);if(!token)return null;
  return database().prepare("SELECT c.id,c.name,c.email FROM customers c JOIN customer_sessions s ON s.customer_id=c.id WHERE s.token_hash=? AND s.expires_at>?").bind(await digest(token),Date.now()).first<Customer>();
}
export async function newSession(customerId:string,request:Request) {
  const token=randomBytes(32).toString("hex");
  await database().batch([
    database().prepare("DELETE FROM customer_sessions WHERE expires_at<=?").bind(Date.now()),
    database().prepare("INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,?)").bind(await digest(token),customerId,Date.now()+DAYS*1000),
  ]);
  return cookie(token,request);
}
export function cookie(token:string,request:Request) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?DAYS:0}${new URL(request.url).protocol==="https:"?"; Secure":""}`;
}
export function sameOrigin(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("sec-fetch-site")==="cross-site")throw new AccountProblem("BAD_ORIGIN",403);
}
export async function accountRate(request:Request,kind:string,max:number) {
  const key=await digest(`customer:${kind}:${request.headers.get("cf-connecting-ip")||"local"}`);
  const window=Math.floor(Date.now()/900000);
  const row=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key,window).first<{hits:number}>();
  if((row?.hits||0)>max)throw new AccountProblem("RATE_LIMIT",429);
}
export async function recordChat(customer:Customer,message:string,response:Record<string,unknown>) {
  const now=Date.now();
  await database().batch([
    ...[{role:"user",text:message},{role:"assistant",text:response.reply,service:response.service,mode:response.mode,reason:response.reason,estimate:response.estimate}].map((data,i)=>database().prepare("INSERT INTO customer_chat(id,customer_id,message_json,created_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),customer.id,JSON.stringify(data),now+i)),
    database().prepare("DELETE FROM customer_chat WHERE customer_id=? AND id NOT IN (SELECT id FROM customer_chat WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT 60)").bind(customer.id,customer.id),
  ]);
}
