import {datePlus, times, todaySydney, validSlot} from "./catalog";

const workMinutes: Record<string, readonly [number,number]> = {
  service:[60,90], brakes:[30,60], battery:[30,45],
  diagnostic:[45,90], tyres:[45,75], aircon:[45,90],
};

export function estimateWork(service:string, vehicle:string) {
  const [min,max] = Object.hasOwn(workMinutes,service) ? workMinutes[service] : [45,90];
  const large = /\b(?:suv|ute|van|hilux|land[\s-]?cruiser|prado|ranger|navara|triton|amarok|hiace|transit|sprinter|d-max)\b/i.test(vehicle);
  const electrified = /\b(?:hybrid|phev|ev|electric|prius|tesla|leaf|ioniq|polestar)\b/i.test(vehicle);
  const extra = large && ["service","brakes","tyres"].includes(service) ? 15 : 0;
  const electrical = electrified && ["battery","diagnostic","aircon"].includes(service) ? 15 : 0;
  return {min:min+extra,max:max+extra+electrical,large:extra>0,electrified:electrical>0};
}

type Slot = {date:string;time:string};
export type PlanningBooking = Slot & {service:string;vehicle:string;status:string};

function minuteOf(time:string) {
  const [hour,minute]=time.split(":").map(Number);
  return hour*60+minute;
}

export function canSchedule(slot:Slot, booking:PlanningBooking, others:PlanningBooking[], capacity:number) {
  if (!validSlot(slot.date,slot.time)) return false;
  const start=minuteOf(slot.time);
  const end=start+estimateWork(booking.service,booking.vehicle).max;
  const saturday=new Date(slot.date+"T12:00:00Z").getUTCDay()===6;
  if (end>(saturday?12:17)*60) return false;
  const day=others.filter(row=>row.date===slot.date);
  if (day.some(row=>row.time===slot.time)) return false;
  const jobs=day.filter(row=>row.status==="confirmed").map(row=>{
    const start=minuteOf(row.time);
    return {start,end:start+estimateWork(row.service,row.vehicle).max};
  });
  for (let minute=start;minute<end;minute+=15) {
    if (jobs.filter(job=>job.start<=minute&&minute<job.end).length>=capacity) return false;
  }
  return true;
}

export function schedulingWindow(booking:Slot) {
  const start=booking.date<todaySydney()?todaySydney():booking.date;
  return {start,end:datePlus(start,6)};
}

export function suggestedSlots(booking:PlanningBooking, others:PlanningBooking[], capacity:number) {
  const {start}=schedulingWindow(booking);
  return Array.from({length:7},(_,index)=>datePlus(start,index)).flatMap(date=>
    times.map(time=>({date,time}))
  ).filter(slot=>
    (slot.date>booking.date || (slot.date===booking.date && slot.time>=booking.time)) &&
    (booking.status==="requested" || slot.date!==booking.date || slot.time!==booking.time) &&
    canSchedule(slot,booking,others,capacity)
  ).slice(0,3);
}
