"use client";

import {useEffect,useRef,useState,type CSSProperties,type FormEvent,type PointerEvent as ReactPointerEvent} from "react";
import {CalendarPlus,ChevronLeft,ChevronRight,Ellipsis} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {datePlus,todaySydney,type Lang} from "@/lib/catalog";
import {rosterMembers,rosterShiftFits,rosterTime,rosterWeekStart,type RosterRequest,type RosterShift} from "@/lib/admin-roster";
import {useRosterShifts} from "@/lib/use-admin-roster";
import "./roster-workspace.css";

type Editor = {week:string;shift:RosterShift;isNew:boolean;request:boolean};
type Drag = {date:string;pointer:number;start:number;end:number};
type Mutation =
  | {type:"save";shift:RosterShift}
  | {type:"delete";id:string}
  | {type:"request";id:string;shift:RosterShift}
  | {type:"request-swap";id:string;first:string;second:string}
  | {type:"review";id:string;approve:boolean};

function textTime(value:string) {
  const [hours,minutes]=value.split(":").map(Number);
  return hours*60+minutes;
}

function shiftLabel(shift:RosterShift) {
  return rosterTime(shift.start)+"–"+rosterTime(shift.end);
}

function memberFor(shift:RosterShift) {
  return rosterMembers.find(member=>member.id===shift.employee)!;
}

export function RosterWorkspace({lang}: {lang:Lang}) {
  const t=(en:string,zh:string)=>lang==="zh"?zh:en;
  const today=todaySydney();
  const [week,setWeek]=useState(()=>rosterWeekStart(today));
  const [employee,setEmployee]=useState<RosterShift["employee"]>(rosterMembers[0].id);
  const [editor,setEditor]=useState<Editor>();
  const [drag,setDrag]=useState<Drag>();
  const gesture=useRef<Drag | undefined>(undefined);
  const [swapping,setSwapping]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const shiftsList=useRef<HTMLElement>(null);
  const requestsList=useRef<HTMLElement>(null);
  const inFlight=useRef(false);
  const requestId=useRef<string | undefined>(undefined);
  const {shifts,requests,revision,loading,error:loadFailed,refresh}=useRosterShifts(week);
  const days=Array.from({length:7},(_,index)=>datePlus(week,index));
  const startHour=Math.min(8,...shifts.map(shift=>Math.floor(shift.start/60)));
  const endHour=Math.max(18,...shifts.map(shift=>Math.ceil(shift.end/60)));
  const hours=Array.from({length:endHour-startHour},(_,index)=>startHour+index);
  const shortDate=new Intl.DateTimeFormat(lang==="zh"?"zh-CN":"en-AU",{day:"numeric",month:"short",timeZone:"UTC"});
  const weekday=new Intl.DateTimeFormat(lang==="zh"?"zh-CN":"en-AU",{weekday:"short",timeZone:"UTC"});
  const formatDate=(date:string)=>shortDate.format(new Date(date+"T12:00:00Z"));

  useEffect(()=>{
    if(!editor && !swapping)requestId.current=undefined;
  },[editor,swapping]);

  function openNew(date:string,start=9*60,end=17*60,asRequest=false) {
    setError("");
    setEditor({week:rosterWeekStart(date),isNew:true,request:asRequest,shift:{
      id:crypto.randomUUID(),employee,date,start,end,breakStart:null,breakEnd:null,
    }});
  }

  function openExisting(shift:RosterShift) {
    setError("");
    setEditor({week,shift,isNew:false,request:false});
  }

  function changeWeek(next:string) {
    gesture.current=undefined;
    setDrag(undefined);
    setWeek(next);
    setNotice("");
    setError("");
  }

  function timeFromPointer(event:ReactPointerEvent<HTMLDivElement>) {
    const bounds=event.currentTarget.getBoundingClientRect();
    const ratio=Math.min(1,Math.max(0,(event.clientY-bounds.top)/bounds.height));
    const minute=startHour*60+Math.floor(ratio*hours.length*4)*15;
    return Math.min(endHour*60-15,minute);
  }

  function beginDrag(event:ReactPointerEvent<HTMLDivElement>,date:string) {
    if(event.button!==0 || event.pointerType!=="mouse" || loading || loadFailed || busy ||
      (event.target as HTMLElement).closest("button"))return;
    const start=timeFromPointer(event);
    const selection={date,pointer:event.pointerId,start,end:start};
    gesture.current=selection;
    setDrag(selection);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event:ReactPointerEvent<HTMLDivElement>) {
    if(gesture.current?.pointer!==event.pointerId)return;
    setDrag({...gesture.current,end:timeFromPointer(event)});
  }

  function finishDrag(event:ReactPointerEvent<HTMLDivElement>) {
    const selection=gesture.current;
    if(selection?.pointer!==event.pointerId)return;
    const end=timeFromPointer(event);
    const start=Math.min(selection.start,end);
    const finish=Math.min(endHour*60-15,Math.max(selection.start,end)+15);
    gesture.current=undefined;
    setDrag(undefined);
    if(finish>start)openNew(selection.date,start,finish,true);
  }

  function rangeStyle(start:number,end:number) {
    return {top:((start-startHour*60)/(hours.length*60))*100+"%",height:((end-start)/(hours.length*60))*100+"%"};
  }

  async function mutate(action:Mutation,success:string) {
    if(inFlight.current || loading || loadFailed)return false;
    inFlight.current=true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response=await fetch("/api/admin-roster",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({week,revision,action}),
      });
      if(response.status===409){
        const body=await response.json() as {error:string};
        setError(body.error==="ROSTER_LIMIT"
          ? t("This week has reached the maximum number of shifts or requests.","本周的班次或请求已达上限。")
          : t("The roster changed or this shift overlaps. Check the refreshed week and try again.","排班已更新或班次有重叠。请查看刷新后的本周排班再试。"));
        refresh();
        return false;
      }
      if(!response.ok)throw Error("Roster update failed");
      setNotice(success);
      refresh();
      return true;
    }catch{
      setError(t("Could not save the roster. Try again.","无法保存排班，请重试。"));
      refresh();
      return false;
    }finally{
      setBusy(false);
      inFlight.current=false;
    }
  }

  async function submitShift(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!editor)return;
    const fields=new FormData(event.currentTarget);
    const breakStart=String(fields.get("breakStart")??"");
    const breakEnd=String(fields.get("breakEnd")??"");
    const shift:RosterShift={
      id:editor.shift.id,
      employee:fields.get("employee") as RosterShift["employee"],
      date:String(fields.get("date")),start:textTime(String(fields.get("start"))),
      end:textTime(String(fields.get("end"))),
      breakStart:breakStart?textTime(breakStart):null,breakEnd:breakEnd?textTime(breakEnd):null,
    };
    if(shift.end<=shift.start || !(shift.breakStart===null && shift.breakEnd===null ||
      shift.breakStart!==null && shift.breakEnd!==null && shift.start<shift.breakStart &&
      shift.breakStart<shift.breakEnd && shift.breakEnd<shift.end)){
      setError(t("Enter an end time after the start, and keep the whole break within the shift.","结束须晚于开始，休息时间须完整地位于班次内。"));
      return;
    }
    if(!rosterShiftFits(shift,shifts)){
      setError(t("This overlaps another shift for the same person.","这与同一员工的另一个班次重叠。"));
      return;
    }
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const requested=submitter?.value==="request" || (!submitter && editor.request);
    requestId.current??=crypto.randomUUID();
    const action= requested
      ? {type:"request",id:requestId.current,shift} as const
      : {type:"save",shift} as const;
    if(await mutate(action,requested
      ? t("Request added for review.","请求已加入审核队列。")
      : t("Shift saved.","班次已保存。")))setEditor(undefined);
  }

  async function submitSwap(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields=new FormData(event.currentTarget);
    const first=String(fields.get("first"));
    const second=String(fields.get("second"));
    if(shifts.find(shift=>shift.id===first)?.employee===shifts.find(shift=>shift.id===second)?.employee){
      setError(t("Choose shifts assigned to two different people.","请选择由两名不同员工负责的班次。"));
      return;
    }
    requestId.current??=crypto.randomUUID();
    if(await mutate({type:"request-swap",id:requestId.current,first,second},
      t("Swap added for review.","换班已加入审核队列。")))setSwapping(false);
  }

  function describeRequest(request:RosterRequest) {
    if(request.kind==="swap"){
      return [request.first,request.second].map(shift=>memberFor(shift).name+" · "+formatDate(shift.date)+" "+shiftLabel(shift)).join(" ↔ ");
    }
    return memberFor(request.shift).name+" · "+formatDate(request.shift.date)+" "+shiftLabel(request.shift);
  }

  function editNextWeek() {
    const next=datePlus(week,7);
    changeWeek(next);
    openNew(next);
  }

  const firstDay=days[0];
  const lastDay=days[6];
  const sortedShifts=[...shifts].sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  const errorMessage=error&&<p role="alert" className="error">{error}</p>;

  return <div className="admin-view roster-workspace">
    <div className="admin-view-header">
      <h1>{t("Roster","排班")}</h1>
      <div className="roster-actions">
        <button type="button" className="roster-button roster-button--primary" disabled={busy||loading||loadFailed}
          onClick={()=>openNew(days.includes(today)?today:week)}>
          <CalendarPlus size={17} aria-hidden="true"/>{t("Add shift","添加班次")}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="roster-button roster-icon-button" aria-label={t("More roster options","更多排班选项")}>
              <Ellipsis aria-hidden="true" size={22}/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="roster-menu">
            <DropdownMenuItem disabled={busy} onSelect={editNextWeek}>{t("Add shift next week","添加下周班次")}</DropdownMenuItem>
            <DropdownMenuItem disabled={loading} onSelect={()=>shiftsList.current?.focus()}>{t("Edit existing shifts","编辑班次")}</DropdownMenuItem>
            <DropdownMenuItem disabled={busy||loading||loadFailed} onSelect={()=>openNew(days.includes(today)?today:week,9*60,17*60,true)}>{t("Create shift request","创建班次请求")}</DropdownMenuItem>
            <DropdownMenuItem disabled={busy||loading||loadFailed||new Set(shifts.map(shift=>shift.employee)).size<2} onSelect={()=>{setError("");setSwapping(true);}}>{t("Request a swap","请求换班")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={()=>requestsList.current?.focus()}>{t("Review requests and swaps","审核班次及换班请求")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <section className="roster-calendar-panel" aria-label={t("Weekly roster","每周排班")}>
      <div className="roster-toolbar">
        <div className="roster-actions">
          <button type="button" className="roster-button roster-icon-button" disabled={busy} aria-label={t("Previous week","上一周")} onClick={()=>changeWeek(datePlus(week,-7))}><ChevronLeft size={18}/></button>
          <strong>{formatDate(firstDay)} – {formatDate(lastDay)}</strong>
          <button type="button" className="roster-button roster-icon-button" disabled={busy} aria-label={t("Next week","下一周")} onClick={()=>changeWeek(datePlus(week,7))}><ChevronRight size={18}/></button>
          <button type="button" className="roster-button" disabled={busy} onClick={()=>changeWeek(rosterWeekStart(today))}>{t("This week","本周")}</button>
        </div>
        <span className="roster-timezone">{t("Sydney time","悉尼时间")}</span>
      </div>
      <div className="roster-member-list" role="group" aria-label={t("Select a staff member to schedule","选择要排班的员工")}>
        {rosterMembers.map(member=><button type="button" key={member.id} className="roster-member" aria-pressed={employee===member.id}
          onClick={()=>setEmployee(member.id)} style={{"--roster-member-color":member.color} as CSSProperties}>
          <span aria-hidden="true"/>{member.name}
        </button>)}
      </div>
      {loadFailed && <p role="alert" className="roster-status">{t("Could not load the roster.","无法加载排班。")} <button type="button" className="roster-button" onClick={refresh}>{t("Retry","重试")}</button></p>}
      {loading && <p role="status" className="roster-status">{t("Loading roster…","正在加载排班…")}</p>}
      <p className="roster-instruction">{t("Choose a team member, then drag over a day to request hours. Use Add shift to enter hours directly.","选中员工后，在日期列中拖动以申请班次。也可以用「添加班次」直接填写时间。")}</p>
      <div className="roster-scroll" tabIndex={0} aria-label={t("Roster calendar. Scroll horizontally for more days.","排班日历。横向滚动可查看其他日期。")}>
        <div className="roster-calendar" style={{"--roster-hours":hours.length} as CSSProperties}>
          <div className="roster-corner"/>
          {days.map(date=><div key={date} className={"roster-day-label"+(date===today?" roster-day-label--today":"")}>
            <span>{weekday.format(new Date(date+"T12:00:00Z"))}</span><strong>{Number(date.slice(-2))}</strong>
          </div>)}
          <div className="roster-hour-labels" aria-hidden="true">{hours.map(hour=><div key={hour}>{rosterTime(hour*60)}</div>)}</div>
          {days.map(date=><div key={date} className="roster-day-column" onPointerDown={event=>beginDrag(event,date)} onPointerMove={moveDrag} onPointerUp={finishDrag}
            onLostPointerCapture={()=>{gesture.current=undefined;setDrag(undefined);}}>
            {hours.map(hour=><div key={hour} className="roster-hour-line" aria-hidden="true"/>)}
            {sortedShifts.filter(shift=>shift.date===date).map(shift=>{
              const member=memberFor(shift);
              const lane=rosterMembers.indexOf(member);
              const hasBreak=shift.breakStart!==null && shift.breakEnd!==null;
              return <button type="button" className="roster-shift" key={shift.id}
                aria-label={t("Edit shift for ","编辑班次：")+member.name+" "+formatDate(date)+" "+shiftLabel(shift)}
                title={member.name+" · "+shiftLabel(shift)+(hasBreak?" · "+t("Break ","休息 ")+rosterTime(shift.breakStart!)+ "–"+rosterTime(shift.breakEnd!):"")}
                onClick={()=>openExisting(shift)} style={{...rangeStyle(shift.start,shift.end),left:(lane/3)*100+"%","--roster-member-color":member.color} as CSSProperties}>
                {hasBreak&&<span className="roster-shift-break" aria-hidden="true" style={{
                  top:((shift.breakStart!-shift.start)/(shift.end-shift.start))*100+"%",
                  height:((shift.breakEnd!-shift.breakStart!)/(shift.end-shift.start))*100+"%",
                }}/>}
                <span className="roster-shift-text"><strong>{member.initials}</strong><span>{shiftLabel(shift)}</span></span>
              </button>;
            })}
            {drag?.date===date&&<div aria-hidden="true" className="roster-drag-range" style={rangeStyle(Math.min(drag.start,drag.end),Math.max(drag.start,drag.end)+15)}/>}
          </div>)}
        </div>
      </div>
      <div className="roster-break-key"><span aria-hidden="true"/>{t("Break","休息")}</div>
    </section>

    {notice&&<p role="status" className="roster-notice">{notice}</p>}
    {!editor&&!swapping&&errorMessage}
    <section className="panel roster-list" tabIndex={-1} ref={shiftsList}>
      <h2>{t("Scheduled shifts","已排班次")}</h2>
      {!loading&&!loadFailed&&!shifts.length&&<p>{t("No shifts scheduled for this week.","本周尚无已排班次。")}</p>}
      {sortedShifts.map(shift=><div className="roster-list-row" key={shift.id}>
        <div><strong>{memberFor(shift).name}</strong><p>{formatDate(shift.date)} · {shiftLabel(shift)}
          {shift.breakStart!==null&&shift.breakEnd!==null&&" · "+t("Break ","休息 ")+rosterTime(shift.breakStart)+"–"+rosterTime(shift.breakEnd)}</p></div>
        <button type="button" className="secondary" disabled={busy||loading} onClick={()=>openExisting(shift)}>{t("Edit","编辑")}</button>
      </div>)}
    </section>
    <section className="panel roster-list" tabIndex={-1} ref={requestsList}>
      <h2>{t("Shift requests","班次请求")}</h2>
      <p className="small muted">{t("Requests stay in this dashboard for review. Share them with staff directly.","请求保存在后台供审核。请直接与员工沟通。")}</p>
      {!loading&&!loadFailed&&!requests.length&&<p>{t("No pending requests for this week.","本周没有待审核请求。")}</p>}
      {requests.map(request=><div className="roster-list-row" key={request.id}>
        <div><strong>{request.kind==="swap"?t("Shift swap","换班"):request.kind==="change"?t("Shift change","班次变更"):t("New shift","新班次")}</strong><p>{describeRequest(request)}</p></div>
        <div className="roster-actions">
          <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void mutate({type:"review",id:request.id,approve:false},t("Request declined.","请求已拒绝。"))}>{t("Decline","拒绝")}</button>
          <button type="button" className="primary" disabled={busy||loading} onClick={()=>void mutate({type:"review",id:request.id,approve:true},t("Request approved and roster updated.","请求已批准，排班已更新。"))}>{t("Approve","批准")}</button>
        </div>
      </div>)}
    </section>

    <Dialog open={!!editor} onOpenChange={value=>{if(!value&&!busy)setEditor(undefined);}}>
      {editor&&<DialogContent className="roster-dialog">
        <DialogTitle>{editor.request?t("Shift request","申请班次"):editor.isNew?t("Add a shift","添加班次"):t("Edit shift","编辑班次")}</DialogTitle>
        <DialogDescription>{editor.request?t("Status: proposed. The request will be added to this week’s review queue.","状态：待审核。请求将加入本周审核队列。"):t("Set working hours and an optional break.","填写工作时段和可选休息时间。")}</DialogDescription>
        <form onSubmit={submitShift}>
          <div className="roster-form-fields">
            <label>{t("Staff member","员工")}<select name="employee" defaultValue={editor.shift.employee}>
              {rosterMembers.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}
            </select></label>
            <label>{t("Date","日期")}<input type="date" name="date" required min={editor.week} max={datePlus(editor.week,6)} defaultValue={editor.shift.date}/></label>
            <label>{t("Start","开始")}<input type="time" name="start" step={900} required defaultValue={rosterTime(editor.shift.start)}/></label>
            <label>{t("Finish","结束")}<input type="time" name="end" step={900} required defaultValue={rosterTime(editor.shift.end)}/></label>
            <label>{t("Break starts","休息开始")}<input type="time" name="breakStart" step={900} defaultValue={editor.shift.breakStart===null?"":rosterTime(editor.shift.breakStart)}/></label>
            <label>{t("Break ends","休息结束")}<input type="time" name="breakEnd" step={900} defaultValue={editor.shift.breakEnd===null?"":rosterTime(editor.shift.breakEnd)}/></label>
          </div>
          {errorMessage}
          <div className="roster-dialog-actions">
            <button type="button" className="secondary" disabled={busy} onClick={()=>setEditor(undefined)}>{editor.request?t("Cancel request","取消请求"):t("Cancel","取消")}</button>
            {!editor.isNew&&<button type="button" className="secondary" disabled={busy||loading} onClick={async()=>{
              if(await mutate({type:"delete",id:editor.shift.id},t("Shift removed.","班次已移除。")))setEditor(undefined);
            }}>{t("Remove shift","移除班次")}</button>}
            {!editor.request&&<button type="submit" value="save" className="secondary" disabled={busy||loading}>{t("Save shift","保存班次")}</button>}
            <button type="submit" value="request" className="primary" disabled={busy||loading}>{t("Send request","发送请求")}</button>
          </div>
        </form>
      </DialogContent>}
    </Dialog>
    <Dialog open={swapping} onOpenChange={value=>{if(!value&&!busy)setSwapping(false);}}>
      {swapping&&<DialogContent className="roster-dialog">
        <DialogTitle>{t("Request a shift swap","请求换班")}</DialogTitle>
        <DialogDescription>{t("Choose two shifts from this week to exchange. The roster changes when the request is approved.","选择本周两个班次进行互换。批准请求后更新排班。")}</DialogDescription>
        <form onSubmit={submitSwap}>
          <div className="roster-form-fields">
            {(["first","second"] as const).map((key,index)=><label key={key}>{index===0?t("First shift","第一个班次"):t("Second shift","第二个班次")}
              <select name={key} required defaultValue=""><option value="">{t("Choose a shift","选择班次")}</option>
                {sortedShifts.map(shift=><option key={shift.id} value={shift.id}>{memberFor(shift).name} · {formatDate(shift.date)} {shiftLabel(shift)}</option>)}
              </select>
            </label>)}
          </div>
          {errorMessage}
          <div className="roster-dialog-actions">
            <button type="button" className="secondary" disabled={busy} onClick={()=>setSwapping(false)}>{t("Cancel request","取消请求")}</button>
            <button type="submit" className="primary" disabled={busy||loading}>{t("Send request","发送请求")}</button>
          </div>
        </form>
      </DialogContent>}
    </Dialog>
  </div>;
}
