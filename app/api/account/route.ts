import {z} from "zod";
import {database} from "@/db";
import {AccountProblem,accountRate,cookie,currentCustomer,customerToken,digest,newSession,passwordHash,passwordMatches,sameOrigin} from "@/lib/customer-session";
import {DUMMY_PASSWORD_HASH} from "@/lib/customer-password";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200,session?:string)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",...(session?{"Set-Cookie":session}:{})}});
const credentials=z.object({email:z.string().trim().email().max(150).transform(v=>v.toLowerCase()),password:z.string().min(12).max(128)});
async function readBody(request:Request) {
  if(Number(request.headers.get("content-length"))>2048||!request.body)throw new AccountProblem("ACCOUNT_INPUT",413);
  const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,raw="";
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw new AccountProblem("ACCOUNT_INPUT",413)}raw+=decoder.decode(value,{stream:true})}return raw+decoder.decode()}finally{reader.releaseLock()}
}
async function run(fn:()=>Promise<Response>) {
  try{return await fn()}catch(e){
    if(e instanceof AccountProblem)return json({error:e.code},e.status);
    if(e instanceof z.ZodError)return json({error:"ACCOUNT_INPUT"},400);
    if(String(e).includes("UNIQUE constraint failed: customers.email"))return json({error:"ACCOUNT_EXISTS"},409);
    console.error("Account request failed");return json({error:"UNAVAILABLE"},503);
  }
}
export async function GET(request:Request) {return run(async()=>{
  const user=await currentCustomer(request);if(!user)return json({user:null,bookings:[],history:[]});
  const [{results:bookings},{results:messages}]=await Promise.all([
    database().prepare("SELECT id,vehicle,service,date,time,status FROM bookings WHERE customer_id=? AND status!='blocked' ORDER BY date DESC,time DESC LIMIT 100").bind(user.id).all(),
    database().prepare("SELECT message_json FROM customer_chat WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT 60").bind(user.id).all<{message_json:string}>(),
  ]);
  return json({user,bookings,history:messages.reverse().map(row=>JSON.parse(row.message_json))});
});}
export async function POST(request:Request) {return run(async()=>{
  sameOrigin(request);
  if(!request.headers.get("content-type")?.includes("application/json"))throw new AccountProblem("ACCOUNT_INPUT");
  const raw=await readBody(request);
  let body;try{body=JSON.parse(raw)}catch{throw new AccountProblem("ACCOUNT_INPUT")}
  if(body?.action==="logout") {
    const token=customerToken(request);if(token)await database().prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,cookie("",request));
  }
  if(body?.action==="clearHistory") {
    const user=await currentCustomer(request);if(!user)throw new AccountProblem("LOGIN_REQUIRED",401);
    await database().prepare("DELETE FROM customer_chat WHERE customer_id=?").bind(user.id).run();return json({ok:true});
  }
  if(body?.action!=="login"&&body?.action!=="signup")throw new AccountProblem("ACCOUNT_INPUT");
  await accountRate(request,"auth",20);
  const data=credentials.parse(body);
  if(body.action==="signup") {
    await accountRate(request,"signup",5);
    const name=z.string().trim().min(1).max(80).parse(body.name);const id=crypto.randomUUID();
    const hash=await passwordHash(data.password);
    await database().prepare("INSERT INTO customers(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)").bind(id,name,data.email,hash,new Date().toISOString()).run();
    return json({user:{id,name,email:data.email}},201,await newSession(id,request));
  }
  const user=await database().prepare("SELECT id,name,email,password_hash FROM customers WHERE email=?").bind(data.email).first<{id:string;name:string;email:string;password_hash:string}>();
  // A fixed, valid dummy encoding keeps unknown-email checks equally expensive.
  const valid=await passwordMatches(data.password,user?.password_hash||DUMMY_PASSWORD_HASH);
  if(!user||!valid)throw new AccountProblem("INVALID_CREDENTIALS",401);
  return json({user:{id:user.id,name:user.name,email:user.email}},200,await newSession(user.id,request));
});}
