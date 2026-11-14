import {canSchedule, isSchedulingCandidate, schedulingWindow, suggestedSlots, type PlanningBooking} from "@/lib/workshop-scheduling";
import {trackedPages} from "@/lib/workshop-analytics";
import {env} from "cloudflare:workers";
import {z} from "zod";
import {database} from "@/db";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {services,times,validSlot,todaySydney,datePlus,withServicePrices,type ServicePrice} from "@/lib/catalog";
import {assistantReply} from "@/lib/assistant";
import {openaiReply,AIError} from "@/lib/openai-assistant";
import {analyseFinancials} from "@/lib/openai-financials";
import {bookingEstimate,type FinancialSummary} from "@/lib/workshop-financials";
import {validateChatImages,readChatRequest,MAX_CHAT_BODY_BYTES,ChatImageError} from "@/lib/chat-images";
import {quickReply} from "@/lib/faq";
import {bookingDetailsSchema,hasNonEnglishBookingText} from "@/lib/booking-input";
import {currentCustomer,digest,recordChat,AccountProblem} from "@/lib/customer-session";
import {verifyHuman,paidChatAllowed,emailVerificationEnabled,budget,paidAIAllowed} from "@/lib/abuse-protection";
import {draftSchema,extractBooking,bookingStatus} from "@/lib/conversation-booking";
export const dynamic="force-dynamic";
class Problem extends Error{constructor(public status:number,public code:string){super(code)}}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
const service=z.enum(services.map(s=>s.id) as [string,...string[]]);
const slot=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.enum(times as [string,...string[]])});
const fields=bookingDetailsSchema.extend({service});
const secret=z.string().regex(/^[a-f0-9]{64}$/);
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(n=>n.toString(16).padStart(2,"0")).join("");}
function valid(d:string,t:string){if(!validSlot(d,t))throw new Problem(400,"INVALID_SLOT");}
async function admin(){const user=await getChatGPTUser();const email=env.ADMIN_EMAIL||process.env.ADMIN_EMAIL;if(!user||!email||user.email.toLowerCase()!==email.trim().toLowerCase())throw new Problem(403,"ADMIN_REQUIRED");return user;}
async function rate(request:Request,kind:string,max:number){const ip=request.headers.get("cf-connecting-ip")||"local";const key=await hash(kind+":"+ip);const window=Math.floor(Date.now()/60000);const r=await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key,window).first<{hits:number}>();if((r?.hits||0)>max)throw new Problem(429,"RATE_LIMIT");}
async function own(request:Request,id:string){
 const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(secret.safeParse(token).success){const row=await database().prepare("SELECT * FROM bookings WHERE id=? AND token_hash=? AND status!='blocked'").bind(id,await digest(token)).first<Record<string,any>>();if(row)return row;}
 const customer=await currentCustomer(request);
 if(customer){const row=await database().prepare("SELECT * FROM bookings WHERE id=? AND customer_id=? AND status!='blocked'").bind(id,customer.id).first<Record<string,any>>();if(row)return row;}
 throw new Problem(404,"NOT_FOUND");
}
async function bookingPhotos(id:string){const {results}=await database().prepare("SELECT id,booking_id,slot,name,mime,size,created_at FROM booking_photos WHERE booking_id=? AND status='ready' ORDER BY slot").bind(id).all();return results;}
function clean(row:Record<string,any>){const {token_hash,customer_id,...safe}=row;return safe;}
async function run(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof AccountProblem)return reply({error:e.code},e.status);if(e instanceof ChatImageError)return reply({error:e.code},e.status);if(e instanceof Problem)return reply({error:e.code},e.status);if(e instanceof z.ZodError)return reply({error:"INVALID_INPUT"},400);console.error(e instanceof Error?e.message:"Request failed");if(String(e).includes("UNIQUE constraint failed: bookings.date"))return reply({error:"SLOT_TAKEN"},409);return reply({error:"UNAVAILABLE"},503);}}
async function readPrices() {
 const {results}=await database().prepare("SELECT service,min,max FROM workshop_prices").all<ServicePrice>();
 return results;
}
const financialMonth=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);

type ReceiptGroup = {service:string;count:number;cents:number};

async function readFinancialSummary(month:string) {
 const start=month+"-01";
 const end=datePlus(month+"-28",4).slice(0,7)+"-01";
 const db=database();
 const [receipts,forecast]=await db.batch([
  db.prepare("SELECT bookings.service, COUNT(*) AS count, SUM(amount_cents) AS cents FROM workshop_receipts JOIN bookings ON bookings.id=workshop_receipts.booking_id WHERE paid_on>=? AND paid_on<? GROUP BY bookings.service").bind(start,end),
  db.prepare("SELECT service, status, COUNT(*) AS count FROM bookings WHERE date>=? AND date<? AND status IN ('requested','confirmed') GROUP BY service,status").bind(start,end),
 ]);
 const receiptGroups=receipts.results as ReceiptGroup[];
 return {
  receiptGroups,
  receipts:receiptGroups.reduce((total,row)=>({count:total.count+row.count,cents:total.cents+row.cents}),{count:0,cents:0}),
  forecast:forecast.results as FinancialSummary["forecast"],
  prices:await readPrices(),
 };
}

const planningCapacity=z.number().int().min(1).max(10);

async function planningBooking(id:string) {
 const booking=await database().prepare(
  "SELECT date,time,service,vehicle,status FROM bookings WHERE id=? AND status IN ('requested','confirmed')"
 ).bind(id).first<PlanningBooking>();
 if(!booking)throw new Problem(409,"NOT_ACTIVE");
 return booking;
}

async function planningJobs(id:string,start:string,end:string) {
 const {results}=await database().prepare(
  "SELECT date,time,service,vehicle,status FROM bookings WHERE date BETWEEN ? AND ? AND id<>? AND status IN ('confirmed','blocked')"
 ).bind(start,end,id).all<PlanningBooking>();
 return results;
}

export async function GET(request:Request){return run(async()=>{const url=new URL(request.url);const action=url.searchParams.get("action");
 if(action==="prices")return reply({prices:await readPrices()});
 if(action==="notice"){
  const notice=await database().prepare("SELECT message_en AS en,message_zh AS zh FROM workshop_notice WHERE id=1").first<{en:string;zh:string}>();
  return reply({notice:notice??{en:"",zh:""}});
 }
 if(action==="adminScheduleWeek"){
  await admin();
  const start=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).date().parse(url.searchParams.get("start"));
  const capacity=planningCapacity.parse(Number(url.searchParams.get("capacity")));
  const db=database();
  const {results:requests}=await db.prepare(
   "SELECT id,date,time,service,vehicle,status FROM bookings WHERE date BETWEEN ? AND ? AND status='requested' ORDER BY date,time,created_at,id LIMIT 50"
  ).bind(start,datePlus(start,6)).all<PlanningBooking & {id:string}>();
  const first=start<todaySydney()?todaySydney():start;
  const jobs=await planningJobs("",first,datePlus(first,12));
  const plans=requests.map(booking=>{
   const [option]=suggestedSlots(booking,jobs,capacity);
   if(option)jobs.push({...booking,...option,status:"confirmed"});
   return {id:booking.id,date:booking.date,time:booking.time,service:booking.service,option:option??null};
  });
  return reply({plans});
 }
 if(action==="adminSchedule"){
  await admin();
  const id=z.string().uuid().parse(url.searchParams.get("id"));
  const capacity=planningCapacity.parse(Number(url.searchParams.get("capacity")));
  const booking=await planningBooking(id);
  const {start,end}=schedulingWindow(booking);
  return reply({slots:suggestedSlots(booking,await planningJobs(id,start,end),capacity)});
 }
 if(action==="adminWeek"){
  await admin();
  const start=url.searchParams.get("start")??"";
  const day=new Date(start+"T12:00:00Z");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==start)throw new Problem(400,"INVALID_INPUT");
  const {results}=await database().prepare("SELECT id,date,time,service,status FROM bookings WHERE date BETWEEN ? AND ? AND status IN ('confirmed','requested','blocked','completed') ORDER BY date,time,id").bind(start,datePlus(start,6)).all();
  return reply({bookings:results});
 }
 if(action==="adminAnalytics"){
  await admin();
  const today=todaySydney();
  const {results}=await database().prepare(
    "SELECT page,SUM(views) AS views FROM workshop_page_views WHERE day BETWEEN ? AND ? GROUP BY page"
  ).bind(datePlus(today,-29),today).all();
  return reply({pages:results});
 }
 if(action==="adminExpenses"){
  await admin();
  const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).parse(url.searchParams.get("month"));
  const {results}=await database().prepare(
    "SELECT id,item,supplier,kind,quantity,amount_cents,due_on,status,repeat_months FROM workshop_expenses WHERE due_on>=? AND due_on<? ORDER BY due_on,id"
  ).bind(month+"-01",datePlus(month+"-28",4).slice(0,7)+"-01").all();
  return reply({expenses:results});
 }
 if(action==="adminFinancials"){
  await admin();
  const month=financialMonth.parse(url.searchParams.get("month"));
  const {receipts,forecast,prices}=await readFinancialSummary(month);
  return reply({receipts,forecast,prices});
 }
 if(action==="availability"){const date=url.searchParams.get("date")||"";if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Problem(400,"INVALID_INPUT");const {results}=await database().prepare("SELECT time FROM bookings WHERE date=? AND status IN ('confirmed','blocked')").bind(date).all<{time:string}>();return reply({times:times.filter(t=>validSlot(date,t)&&!results.some(r=>r.time===t))});}
 if(action==="booking"){await rate(request,"lookup",30);const row=await own(request,url.searchParams.get("id")||"");return reply({booking:{...clean(row),photos:await bookingPhotos(String(row.id))}});}
 if(action==="admin"){await admin();const date=url.searchParams.get("date")||todaySydney();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Problem(400,"INVALID_INPUT");const {results}=await database().prepare("SELECT bookings.id,name,email,phone,vehicle,service,date,time,notes,status,created_at,paid_on,amount_cents FROM bookings LEFT JOIN workshop_receipts ON bookings.id=workshop_receipts.booking_id WHERE date=? ORDER BY time").bind(date).all();return reply({bookings:await Promise.all(results.map(async row=>({...row,photos:await bookingPhotos(String(row.id))})))});}
 return reply({mode:(env.OPENAI_API_KEY||process.env.OPENAI_API_KEY)?"ai":"rules",timezone:"Australia/Sydney"});});}
export async function POST(request:Request){return run(async()=>{
 if(request.headers.get("sec-fetch-site")==="cross-site"||request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)throw new Problem(403,"BAD_ORIGIN");
 if(!request.headers.get("content-type")?.includes("application/json"))throw new Problem(400,"INVALID_INPUT");
 const imageRequest=request.headers.get("x-chat-images")==="1";
 if(imageRequest)await rate(request,"chat",12);
 const raw=await readChatRequest(request,imageRequest?MAX_CHAT_BODY_BYTES:24000);let b:any;try{b=JSON.parse(raw)}catch{throw new Problem(400,"INVALID_INPUT")}
 if(!b||typeof b!=="object")throw new Problem(400,"INVALID_INPUT");
 if(imageRequest&&b.action!=="chat")throw new Problem(400,"INVALID_INPUT");
 if(b.action==="adminFinancialAnalysis"){
  const user=await admin();
  const {month,lang}=z.object({month:financialMonth,lang:z.enum(["zh","en"])}).parse(b);
  const summary=await readFinancialSummary(month);
  if(!summary.receipts.count&&!summary.forecast.length)return reply({analysis:null});

  const key=env.OPENAI_API_KEY||process.env.OPENAI_API_KEY;
  if(!key)throw new Problem(503,"AI_UNAVAILABLE");
  if(!await budget(user.userId,"finance-ai",10)||!await paidAIAllowed())
   throw new Problem(429,"AI_LIMIT");

  // Only aggregate amounts and counts go to the model. Service names come from the catalogue.
  const snapshot={
   month,asOfSydney:todaySydney(),currency:"AUD",
   recordedReceipts:{count:summary.receipts.count,total:summary.receipts.cents/100},
   receiptsByService:summary.receiptGroups.map(row=>({
    service:services.find(item=>item.id===row.service)?.[lang]??(lang==="zh"?"其他服务":"Other service"),
    count:row.count,total:row.cents/100,
   })),
   confirmedEstimate:bookingEstimate(summary,"confirmed"),
   pendingEstimate:bookingEstimate(summary,"requested"),
   serviceDemand:services.map(item=>({
    service:item[lang],
    confirmed:summary.forecast.find(row=>row.service===item.id&&row.status==="confirmed")?.count??0,
    pending:summary.forecast.find(row=>row.service===item.id&&row.status==="requested")?.count??0,
   })).filter(row=>row.confirmed||row.pending),
  };
  try{
   return reply({analysis:await analyseFinancials(key,lang,snapshot)});
  }catch(error){
   if(error instanceof AIError)throw new Problem(error.code==="AI_BUSY"?429:503,error.code);
   throw error;
  }
 }
 if(b.action==="pageView"){
  const page=z.enum(trackedPages).parse(b.page);
  const day=todaySydney();
  await database().prepare(
    "INSERT INTO workshop_page_views(day,page,views) VALUES(?,?,1) ON CONFLICT(day,page) DO UPDATE SET views=views+1"
  ).bind(day,page).run();
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
 }
 if(b.action==="prepareBooking"){
  await rate(request,"chat",12);
  const customer=await currentCustomer(request);
  if(b.customerId!==(customer?.id||null))throw new Problem(409,"SESSION_CHANGED");
  const data=z.object({message:z.string().trim().min(1).max(1500),lang:z.enum(["en","zh"]),draft:draftSchema.default({})}).parse(b);
  if(/smoke|fire|fuel leak|brake failure|overheat|冒烟|着火|失灵|过热|燃油泄漏/i.test(data.message))return reply({...assistantReply(data.message,data.lang),bookingDraft:data.draft,bookingReady:false,mode:"guide"});
  const {draft}=extractBooking(data.message,data.draft);
  if(customer){draft.name ||= customer.name;draft.email ||= customer.email;}
  let available:string[]=[];
  if(draft.date&&/^\d{4}-\d{2}-\d{2}$/.test(draft.date)){
    const {results}=await database().prepare("SELECT time FROM bookings WHERE date=? AND status IN ('confirmed','blocked')").bind(draft.date).all<{time:string}>();
    available=times.filter(t=>validSlot(draft.date!,t)&&!results.some(r=>r.time===t));
  }
  const status=bookingStatus(draft,available,data.lang);
  draft.awaiting=status.ready?undefined:status.awaiting;
  return reply({reply:status.reply,bookingDraft:draft,bookingReady:status.ready,available,service:draft.service,mode:"guide"});
 }
 if(b.action==="create"){if(hasNonEnglishBookingText(b))throw new Problem(400,"ENGLISH_ONLY");await rate(request,"create",12);const d=fields.merge(slot).extend({requestId:z.string().uuid(),token:secret}).parse(b);valid(d.date,d.time);const tokenHash=await hash(d.token);const existing=await database().prepare("SELECT * FROM bookings WHERE id=?").bind(d.requestId).first<Record<string,any>>();if(existing){if(existing.token_hash!==tokenHash)throw new Problem(409,"INVALID_INPUT");return reply({booking:{...clean(existing),photos:await bookingPhotos(String(existing.id))}});}
 const customer=await currentCustomer(request);
 if(Object.prototype.hasOwnProperty.call(b,"expectedCustomerId")&&b.expectedCustomerId!==(customer?.id||null))throw new Problem(409,"SESSION_CHANGED");
 await database().prepare("INSERT INTO bookings(id,customer_id,token_hash,name,email,phone,vehicle,service,date,time,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)").bind(d.requestId,customer?.id||null,tokenHash,d.name,d.email,d.phone,d.vehicle,d.service,d.date,d.time,d.notes,new Date().toISOString()).run();const row=await database().prepare("SELECT * FROM bookings WHERE id=?").bind(d.requestId).first<Record<string,any>>();return reply({booking:{...clean(row!),photos:[]}},201);}
 if(b.action==="cancel"||b.action==="reschedule"){await rate(request,"manage",20);const row=await own(request,z.string().uuid().parse(b.id));if(row.status!=="confirmed")throw new Problem(409,"NOT_ACTIVE");
 if(b.action==="cancel"){const result=await database().prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'").bind(row.id).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");}
 else{const d=slot.parse(b);valid(d.date,d.time);const result=await database().prepare("UPDATE bookings SET date=?,time=? WHERE id=? AND status='confirmed'").bind(d.date,d.time,row.id).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");}return reply({ok:true});}
 if(b.action==="adminExpense"){
  await admin();
  const data=z.object({
    id:z.string().uuid(), item:z.string().trim().min(1).max(100),supplier:z.string().trim().min(1).max(100),
    kind:z.enum(["purchase","recurring"]),quantity:z.number().int().min(1).max(10000),
    amountCents:z.number().int().min(1).max(100000000),dueOn:z.string().date().regex(/^20\d{2}-/),repeatMonths:z.union([z.literal(1),z.literal(3),z.literal(12)]),
  }).parse(b);
  await database().prepare(
    "INSERT INTO workshop_expenses(id,item,supplier,kind,quantity,amount_cents,due_on,repeat_months,repeat_day) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING"
  ).bind(data.id,data.item,data.supplier,data.kind,data.kind==="recurring"?1:data.quantity,data.amountCents,data.dueOn,data.kind==="recurring"?data.repeatMonths:0,Number(data.dueOn.slice(-2))).run();
  return reply({ok:true},201);
 }
 if(b.action==="adminCancelExpense"){
  await admin();
  await database().prepare("UPDATE workshop_expenses SET status='cancelled' WHERE id=? AND status='open'")
    .bind(z.string().uuid().parse(b.id)).run();
  return reply({ok:true});
 }
 if(b.action==="adminSettleExpense"){
  await admin();
  const id=z.string().uuid().parse(b.id);
  const db=database();
  const entry=await db.prepare("SELECT due_on,repeat_months,repeat_day FROM workshop_expenses WHERE id=? AND status='open'").bind(id).first<{due_on:string;repeat_months:number;repeat_day:number}>();
  if(!entry)return reply({ok:true});
  const settle=db.prepare("UPDATE workshop_expenses SET status='settled' WHERE id=? AND status='open'").bind(id);
  if(!entry.repeat_months){
    await settle.run();
  }else{
    const due=new Date(entry.due_on+"T00:00:00Z");
    due.setUTCDate(1);
    due.setUTCMonth(due.getUTCMonth()+entry.repeat_months+1,0);
    due.setUTCDate(Math.min(entry.repeat_day,due.getUTCDate()));
    const nextDue=due.toISOString().slice(0,10);
    await db.batch([
      db.prepare("INSERT INTO workshop_expenses(id,item,supplier,kind,quantity,amount_cents,due_on,repeat_months,repeat_day) SELECT ?,item,supplier,kind,quantity,amount_cents,?,repeat_months,repeat_day FROM workshop_expenses WHERE id=? AND status='open'")
        .bind(crypto.randomUUID(),nextDue,id),
      settle,
    ]);
  }
  return reply({ok:true});
 }
 if(b.action==="adminPrices"){
  await admin();
  const price=z.number().int().min(0).max(1000000);
  const rows=z.array(z.object({service,min:price,max:price}).refine(row=>row.min<=row.max))
    .length(services.length).refine(rows=>new Set(rows.map(row=>row.service)).size===services.length).parse(b.prices);
  const db=database();
  await db.batch(rows.map(row=>db.prepare(
    "INSERT INTO workshop_prices(service,min,max) VALUES(?,?,?) ON CONFLICT(service) DO UPDATE SET min=excluded.min,max=excluded.max"
  ).bind(row.service,row.min,row.max)));
  return reply({ok:true});
 }
 if(b.action==="adminReceipt"){
  await admin();
  const {id,paidOn,amountCents}=z.object({
    id:z.string().uuid(),
    paidOn:z.string().date(),
    amountCents:z.number().int().min(1).max(100000000),
  }).parse(b);
  if(paidOn>todaySydney())throw new Problem(400,"INVALID_INPUT");
  const result=await database().prepare(
    "INSERT INTO workshop_receipts (booking_id,paid_on,amount_cents) SELECT id,?,? FROM bookings WHERE id=? AND status='completed' ON CONFLICT(booking_id) DO UPDATE SET paid_on=excluded.paid_on,amount_cents=excluded.amount_cents"
  ).bind(paidOn,amountCents,id).run();
  if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");
  return reply({ok:true});
 }
 if(b.action==="adminRequest"){
  await admin();
  const d=fields.merge(slot).extend({requestId:z.string().uuid()}).parse(b);
  valid(d.date,d.time);
  // A request is tentative and does not claim an available slot.
  await database().prepare("INSERT INTO bookings(id,token_hash,name,email,phone,vehicle,service,date,time,notes,status,created_at) VALUES(?,'',?,?,?,?,?,?,?,?,'requested',?) ON CONFLICT(id) DO NOTHING").bind(d.requestId,d.name,d.email,d.phone,d.vehicle,d.service,d.date,d.time,d.notes,new Date().toISOString()).run();
  return reply({ok:true},201);
 }
 if(b.action==="adminApplySchedule"){
  await admin();
  const data=slot.extend({
   id:z.string().uuid(),capacity:planningCapacity,
   originalDate:z.string().date(),originalTime:z.string(),originalStatus:z.enum(["requested","confirmed"]),
  }).parse(b);
  const current=await planningBooking(data.id);
  if(current.date!==data.originalDate||current.time!==data.originalTime||current.status!==data.originalStatus)
   throw new Problem(409,"NOT_ACTIVE");
  if(!isSchedulingCandidate(data,current))
   throw new Problem(409,"SLOT_TAKEN");
  // Compare the day's workload in the same statement that changes the slot.
  // A concurrent booking, closure or completion forces the administrator to recheck.
  const daySnapshot="SELECT json_group_array(json_array(time,service,vehicle,status)) AS jobs FROM (SELECT time,service,vehicle,status FROM bookings WHERE date=? AND id<>? AND status IN ('confirmed','blocked') ORDER BY time,id)";
  const db=database();
  const snapshot=await db.prepare(daySnapshot).bind(data.date,data.id).first<{jobs:string}>();
  const jobs=(JSON.parse(snapshot?.jobs??"[]") as [string,string,string,string][]).map(([time,service,vehicle,status])=>({
   date:data.date,time,service,vehicle,status,
  }));
  if(!canSchedule(data,current,jobs,data.capacity))throw new Problem(409,"SLOT_TAKEN");
  const result=await db.prepare(
   "UPDATE bookings SET date=?,time=?,status='confirmed' WHERE id=? AND status=? AND date=? AND time=? AND ("+daySnapshot+")=?"
  ).bind(data.date,data.time,data.id,current.status,current.date,current.time,data.date,data.id,snapshot?.jobs??"[]").run();
  if(!result.meta.changes)throw new Problem(409,"SLOT_TAKEN");
  return reply({ok:true});
 }
 if(b.action==="adminConfirmRequest"){
  await admin();
  const id=z.string().uuid().parse(b.id);
  const requested=await database().prepare("SELECT date,time FROM bookings WHERE id=? AND status='requested'").bind(id).first<{date:string;time:string}>();
  if(!requested)throw new Problem(409,"NOT_ACTIVE");
  valid(requested.date,requested.time);
  // The existing unique active-slot index arbitrates races with public bookings and closures.
  const result=await database().prepare("UPDATE bookings SET status='confirmed' WHERE id=? AND status='requested'").bind(id).run();
  if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");
  return reply({ok:true});
 }
 if(b.action==="adminNotice"){
  await admin();
  const {en,zh}=z.object({en:z.string().trim().max(500),zh:z.string().trim().max(500)}).parse(b);
  await database().prepare("INSERT INTO workshop_notice(id,message_en,message_zh) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET message_en=excluded.message_en,message_zh=excluded.message_zh").bind(en,zh).run();
  return reply({notice:{en,zh}});
 }
 if(b.action==="adminStatus"){await admin();const d=z.object({id:z.string().uuid(),status:z.enum(["cancelled","completed"])}).parse(b);const result=await database().prepare("UPDATE bookings SET status=? WHERE id=? AND (status='confirmed' OR (?='cancelled' AND status IN ('blocked','requested')))").bind(d.status,d.id,d.status).run();if(!result.meta.changes)throw new Problem(409,"NOT_ACTIVE");return reply({ok:true});}
 if(b.action==="block"){await admin();const d=slot.parse(b);valid(d.date,d.time);await database().prepare("INSERT INTO bookings(id,token_hash,name,email,phone,vehicle,service,date,time,notes,status,created_at) VALUES(?,'','','','','','',?,?,'','blocked',?)").bind(crypto.randomUUID(),d.date,d.time,new Date().toISOString()).run();return reply({ok:true});}

 if(b.action==="chat"){
  if(!imageRequest)await rate(request,"chat",12);
  const images=validateChatImages(b.images);
  const turn=z.object({role:z.enum(["user","assistant"]),content:z.string().max(4500)});
  const d=z.object({message:z.string().trim().min(1).max(1500),lang:z.enum(["zh","en"]),history:z.array(z.union([z.string().max(1500),turn])).max(8).default([])}).parse(b);
  const history=d.history.map(h=>typeof h==="string"?{role:"user" as const,content:h}:h);
  if(history.reduce((n,h)=>n+h.content.length,0)>16000)throw new Problem(400,"INVALID_INPUT");
  const customer=await currentCustomer(request);
  if(Object.prototype.hasOwnProperty.call(b,"customerId")&&b.customerId!==(customer?.id||null))throw new Problem(409,"SESSION_CHANGED");
  async function chatReply(result:Record<string,unknown>){
   let saved=false;
   if(customer){try{await recordChat(customer,d.message,result,images.length);saved=true}catch{console.warn("Chat history save unavailable")}}
   return reply({...result,historySaved:saved,signedIn:!!customer});
  }
  const catalogue=withServicePrices(await readPrices());
  const customerHistory=history.filter(h=>h.role==="user").map(h=>h.content);
  const quick=quickReply(d.message,d.lang,customerHistory,catalogue);
  if(quick&&!images.length)return chatReply(quick);
  const key=env.OPENAI_API_KEY||process.env.OPENAI_API_KEY;
  const fallback=(reason:string)=>images.length?{
   reply:d.lang==="zh"?"图片分析暂时不可用，本次没有分析你的图片，也无法据此报价。请稍后重试，或描述症状、预约现场检查。若存在烟雾、燃油泄漏、刹车失灵或严重过热，请安全停车并联系道路救援。":"Photo analysis is unavailable. Your images have not been analysed and no image-based estimate can be given. Retry shortly, describe the symptoms or book an inspection. For smoke, fuel leaks, brake failure or severe overheating, stop safely and contact roadside assistance.",
   service:null,estimate:null,book:false,mode:"rules",reason,imageAnalysis:"unavailable"
  }:{...assistantReply(d.message,d.lang,customerHistory,catalogue),mode:"rules",reason};
  if(!key)return chatReply(fallback("not_configured"));
  await verifyHuman(request,b.humanToken,"chat");
  if(emailVerificationEnabled()&&(!customer||!customer.emailVerifiedAt))throw new Problem(403,"EMAIL_VERIFICATION_REQUIRED");
  if(!await paidChatAllowed(request,customer?.id))return chatReply(fallback("personal_limit"));
  if(!await paidAIAllowed())return chatReply(fallback("daily_limit"));
  try{return chatReply(await openaiReply(key,d.message,d.lang,history,fetch,images,catalogue));}
  catch(e){console.warn("OpenAI request unavailable",e instanceof AIError?e.code:"AI_UNAVAILABLE");return chatReply(fallback("temporarily_unavailable"));}
 }
 throw new Problem(400,"INVALID_INPUT");});}
