import {datePlus} from "./catalog";

export const rosterMembers = [
  {id:"frank",name:"Frank Bennett",color:"#b7547f",initials:"FB"},
  {id:"daniel",name:"Daniel Park",color:"#405da9",initials:"DP"},
  {id:"alex",name:"Alex Chen",color:"#367160",initials:"AC"},
] as const;

export type RosterMember = (typeof rosterMembers)[number];
type RosterMemberId = RosterMember["id"];

export type RosterShift = {
  id:string;
  employee:RosterMemberId;
  date:string;
  start:number;
  end:number;
  breakStart:number | null;
  breakEnd:number | null;
};

export type RosterRequest =
  | {id:string;kind:"new";shift:RosterShift}
  | {id:string;kind:"change";shift:RosterShift;original:RosterShift}
  | {id:string;kind:"swap";first:RosterShift;second:RosterShift};

export type RosterWeek = {shifts:RosterShift[];requests:RosterRequest[];revision:number};

export function rosterWeekStart(date:string) {
  const day = new Date(date+"T12:00:00Z").getUTCDay();
  return datePlus(date,-((day+6)%7));
}

export function rosterTime(minutes:number) {
  return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");
}

export function getRosterAvailability(shifts:RosterShift[],date:string) {
  return rosterMembers.filter(member=>shifts.some(shift=>shift.date===date && shift.employee===member.id));
}

export function rosterShiftFits(shift:RosterShift,shifts:RosterShift[]) {
  return !shifts.some(existing=>existing.id!==shift.id && existing.date===shift.date &&
    existing.employee===shift.employee && existing.start<shift.end && shift.start<existing.end);
}
