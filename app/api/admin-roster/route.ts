import {env} from "cloudflare:workers";
import {z} from "zod";
import {database} from "@/db";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {datePlus} from "@/lib/catalog";
import {readChatRequest} from "@/lib/chat-images";
import {rosterShiftFits,rosterWeekStart,type RosterRequest,type RosterShift,type RosterWeek} from "@/lib/admin-roster";

export const dynamic="force-dynamic";

const dateSchema=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).date();
const weekSchema=dateSchema.refine(date=>date===rosterWeekStart(date));
const idSchema=z.string().uuid();
const minutes=z.number().int().min(0).max(1425).multipleOf(15);
const shiftSchema=z.object({
  id:idSchema,
  employee:z.enum(["frank","daniel","alex"]),
  date:dateSchema,
  start:minutes,
  end:minutes,
  breakStart:minutes.nullable(),
  breakEnd:minutes.nullable(),
}).refine(shift=>shift.end>shift.start && (
  shift.breakStart===null && shift.breakEnd===null ||
  shift.breakStart!==null && shift.breakEnd!==null && shift.start<shift.breakStart &&
    shift.breakStart<shift.breakEnd && shift.breakEnd<shift.end
));
const commandSchema=z.object({
  week:weekSchema,revision:z.number().int().nonnegative(),
  action:z.discriminatedUnion("type",[
    z.object({type:z.literal("save"),shift:shiftSchema}),
    z.object({type:z.literal("delete"),id:idSchema}),
    z.object({type:z.literal("request"),id:idSchema,shift:shiftSchema}),
    z.object({type:z.literal("request-swap"),id:idSchema,first:idSchema,second:idSchema}),
    z.object({type:z.literal("review"),id:idSchema,approve:z.boolean()}),
  ]),
});

const reply=(body:unknown,status=200)=>Response.json(body,{
  status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"},
});
const conflict=()=>reply({error:"ROSTER_CONFLICT"},409);

async function authorized(){
  const user=await getChatGPTUser();
  const adminEmail=env.ADMIN_EMAIL||process.env.ADMIN_EMAIL;
  return !!user && !!adminEmail && user.email.toLowerCase()===adminEmail.trim().toLowerCase();
}

async function readWeek(week:string):Promise<RosterWeek>{
  const row=await database().prepare("SELECT data,revision FROM workshop_roster_weeks WHERE week=?")
    .bind(week).first<{data:string;revision:number}>();
  if(!row)return {shifts:[],requests:[],revision:0};
  const data:Pick<RosterWeek,"shifts"|"requests">=JSON.parse(row.data);
  return {...data,revision:row.revision};
}

export async function GET(request:Request){
  if(!await authorized())return reply({error:"ADMIN_REQUIRED"},403);
  const week=weekSchema.safeParse(new URL(request.url).searchParams.get("week"));
  if(!week.success)return reply({error:"INVALID_INPUT"},400);
  try{return reply(await readWeek(week.data));}
  catch{return reply({error:"UNAVAILABLE"},503);}
}

function sameShift(current:RosterShift|undefined,original:RosterShift){
  return !!current && current.employee===original.employee && current.date===original.date &&
    current.start===original.start && current.end===original.end &&
    current.breakStart===original.breakStart && current.breakEnd===original.breakEnd;
}

function canApprove(request:RosterRequest,shifts:RosterShift[]){
  if(request.kind==="new")return !shifts.some(shift=>shift.id===request.shift.id) && rosterShiftFits(request.shift,shifts);
  if(request.kind==="change"){
    return sameShift(shifts.find(shift=>shift.id===request.original.id),request.original) && rosterShiftFits(request.shift,shifts);
  }
  const {first,second}=request;
  const unchanged=shifts.filter(shift=>shift.id!==first.id && shift.id!==second.id);
  return sameShift(shifts.find(shift=>shift.id===first.id),first) &&
    sameShift(shifts.find(shift=>shift.id===second.id),second) &&
    rosterShiftFits({...first,employee:second.employee},unchanged) &&
    rosterShiftFits({...second,employee:first.employee},unchanged);
}

export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin || request.headers.get("sec-fetch-site")==="cross-site"){
    return reply({error:"BAD_ORIGIN"},403);
  }
  if(!await authorized())return reply({error:"ADMIN_REQUIRED"},403);
  if(!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"INVALID_INPUT"},400);
  let body:unknown;
  try{body=JSON.parse(await readChatRequest(request,4096));}
  catch{return reply({error:"INVALID_INPUT"},400);}
  const command=commandSchema.safeParse(body);
  if(!command.success)return reply({error:"INVALID_INPUT"},400);
  const {week,revision,action}=command.data;
  try{
    const current=await readWeek(week);
    if(current.revision!==revision)return conflict();
    let {shifts,requests}=current;
    if(action.type==="save" || action.type==="request"){
      const shift=action.shift;
      if(shift.date<week || shift.date>datePlus(week,6))return reply({error:"INVALID_INPUT"},400);
      if(!rosterShiftFits(shift,shifts))return conflict();
      const existing=shifts.find(item=>item.id===shift.id);
      if(!existing && shifts.length>=84)return reply({error:"ROSTER_LIMIT"},409);
      if(action.type==="save"){
        shifts=[...shifts.filter(item=>item.id!==shift.id),shift];
      }else if(!requests.some(item=>item.id===action.id)){
        requests=[...requests,existing
          ? {id:action.id,kind:"change",shift,original:existing}
          : {id:action.id,kind:"new",shift}];
      }
    }else if(action.type==="delete"){
      shifts=shifts.filter(shift=>shift.id!==action.id);
    }else if(action.type==="request-swap"){
      const first=shifts.find(shift=>shift.id===action.first);
      const second=shifts.find(shift=>shift.id===action.second);
      if(!first || !second || first.employee===second.employee)return conflict();
      const swap={id:action.id,kind:"swap",first,second} as const;
      if(!canApprove(swap,shifts))return conflict();
      if(!requests.some(item=>item.id===action.id))requests=[...requests,swap];
    }else{
      const pending=requests.find(item=>item.id===action.id);
      if(!pending)return conflict();
      if(action.approve){
        if(!canApprove(pending,shifts))return conflict();
        if(pending.kind==="swap"){
          const {first,second}=pending;
          shifts=shifts.map(shift=>shift.id===first.id?{...shift,employee:second.employee}:
            shift.id===second.id?{...shift,employee:first.employee}:shift);
        }else{
          shifts=[...shifts.filter(shift=>shift.id!==pending.shift.id),pending.shift];
        }
      }
      requests=requests.filter(item=>item.id!==pending.id);
    }
    if(shifts.length>84 || requests.length>42)return reply({error:"ROSTER_LIMIT"},409);
    const data=JSON.stringify({shifts,requests});
    const db=database();
    const write=revision===0
      ? db.prepare("INSERT INTO workshop_roster_weeks (week,data,revision) VALUES (?,?,1) ON CONFLICT (week) DO NOTHING")
        .bind(week,data)
      : db.prepare("UPDATE workshop_roster_weeks SET data=?,revision=revision+1 WHERE week=? AND revision=?")
        .bind(data,week,revision);
    const result=await write.run();
    if(!result.meta.changes)return conflict();
    return reply({shifts,requests,revision:revision+1});
  }catch{return reply({error:"UNAVAILABLE"},503);}
}
