import {z} from 'zod';
import {datePlus,todaySydney,services,validSlot,type Lang} from './catalog';
import {bookingDetailsSchema,type BookingField} from './booking-input';
export const draftSchema=z.object({awaiting:z.enum(['date','time','service','vehicle','name','email','phone','notes']).optional(),service:z.enum(services.map(s=>s.id) as [string,...string[]]).optional(),date:z.string().max(10).optional(),time:z.string().max(5).optional(),name:z.string().max(80).optional(),email:z.string().max(150).optional(),phone:z.string().max(30).optional(),vehicle:z.string().max(120).optional(),notes:z.string().max(1000).optional()});
export type BookingDraft=z.infer<typeof draftSchema>;
const tomorrowPattern='(?:tomorrow|tmr|tmrw|tmro|tmw|2moro|2morrow|2mrw)';
const tomorrowWords=new RegExp('\\b'+tomorrowPattern+'\\b','i');
const todayWords = /今天|今日|\btoday\b/i;
const weekdayWords = /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const weekdayShortPattern='(?:sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)';
const abbreviatedWeekday=new RegExp('\\b('+weekdayShortPattern+')\\b','i');
const datedWeekday=new RegExp('\\b(?:on|for|next|this)\\s+('+weekdayShortPattern+')\\b','i');
const weekdayWithTime=new RegExp('^('+weekdayShortPattern+')\\.?(?:[.!?]*$|\\s+(?:at\\b|[0-9]|arvo\\b|morning\\b|am\\b|pm\\b))','i');
const dayAndHour=new RegExp('\\b(?:today|'+tomorrowPattern+'|'+weekdayShortPattern+'|'+weekdayWords.source+')\\.?\\s+(?:at\\s+)?(?:(?:arvo|morning|afternoon)\\s+)?(\\d{1,2})(?:\\s+(?:arvo|morning|afternoon))?[.!? ]*$','i');

export function wantsEarliestBooking(text:string) {
 return /\b(?:asap|a\.s\.a\.p|as soon as possible|(?:earliest|soonest|first|next)\s+(?:avail(?:able)?|opening|appointment|appt|slot|time))\b|尽快|儘快|越快越好|最早(?:的)?(?:时段|時段|时间|時間|预约|預約)?/i.test(text);
}

export function bookingIntent(text:string) {
 if(/取消|改期|cancel|reschedul/i.test(text))return false;
 if(/预约|預約|\b(?:book(?:ing)?|appointments?|appts?)\b/i.test(text))return true;
 const timing=tomorrowWords.test(text)||todayWords.test(text)||weekdayWords.test(text)||abbreviatedWeekday.test(text)||/\btom\b|明天|明早|明晨|明晚/i.test(text);
 const scheduling=/\b(?:can we do|let(?:'|’)s do|lets do|fit me in|can i come in)\b/i.test(text);
 return (timing&&scheduling)||
  (wantsEarliestBooking(text)&&/\b(?:fix|repair|come in|fit me in|available (?:slot|time)|check[- ]?in)\b|修车|修車|到店/i.test(text));
}

const detailLabels:Record<string,BookingField> = {
 name:'name',email:'email',phone:'phone',vehicle:'vehicle',car:'vehicle',notes:'notes',
 姓名:'name',邮箱:'email',郵箱:'email',电话:'phone',電話:'phone',车辆:'vehicle',車輛:'vehicle',备注:'notes',備註:'notes',
};
const detailLabel=String.raw`\b(?:name|email|phone|vehicle|car|notes)\b|姓名|邮箱|郵箱|电话|電話|车辆|車輛|备注|備註`;
const labelledDetail=new RegExp('^('+detailLabel+')\\s*[:：]\\s*([\\s\\S]*)$','i');
const labelSeparator=new RegExp('[,，/／]\\s*(?=(?:'+detailLabel+')\\s*[:：])','i');
const vehicleMakes='Toyota|Honda|Mazda|Ford|BMW|Audi|Mercedes|Porsche|Hyundai|Kia|Nissan|Tesla|Volkswagen|Subaru|Holden|Lexus|Suzuki|Mitsubishi';
const compactVehicleYear=new RegExp(String.raw`\b((?:19|20)\d{2})(${vehicleMakes})(?=\s+[A-Za-z0-9])`,'gi');
const vehicleInText=new RegExp(String.raw`\b((?:19|20)\d{2}\s+(?:${vehicleMakes})\s+[A-Za-z0-9 /-]+?)(?=[,;.\n]|\s+(?:and|with|at|for|on|tomorrow|tmr|tmrw|tmro|tmw)\b|$)`,'i');

function spaceVehicleYear(value:string) {
 return value.replace(compactVehicleYear,'$1 $2');
}

function looksLikeName(value:string) {
 return bookingDetailsSchema.shape.name.safeParse(value).success &&
  !/^(?:(?:can|could|would|should|do|does|did|is|are|will|may|have|has)\s+(?:i|we|you|there|it|this|that)|i|we|please|thanks?|yes|no|ok(?:ay)?|hi|hello|hey|available|free|maybe|actually)\b/i.test(value) &&
  !/^(?:what|which|when|where|why|how)\s+(?:i|we|you|can|could|would|is|are|do|does|long|much|many)\b/i.test(value);
}

function bookingName(value:string) {
 return looksLikeName(value)&&!todayWords.test(value)&&!tomorrowWords.test(value)&&!weekdayWords.test(value)&&
  !datedWeekday.test(value)&&!wantsEarliestBooking(value);
}

function contactKind(value:string):Exclude<BookingField,'name'|'notes'>|undefined {
 if(value.includes('@')&&!/\s/.test(value))return 'email';
 const vehicle=spaceVehicleYear(value);
 if((/^(?:18|19|20)\d{2}\s+/.test(vehicle)||/^[A-Za-z][A-Za-z0-9&.'+-]*(?:\s+[A-Za-z0-9&.'+/-]+)+\s+(?:18|19|20)\d{2}$/.test(vehicle))&&
    bookingDetailsSchema.shape.vehicle.safeParse(vehicle).success)return 'vehicle';
 if(!/^\d{1,4}\s*-\s*\d{1,2}\s*-\s*\d{1,4}$/.test(value)&&/^[+\d ()-]+$/.test(value)&&value.replace(/\D/g,'').length>=6)return 'phone';
}

function compactNameAndVehicle(value:string):[string,string]|undefined {
 const match=value.match(/^([A-Za-z][A-Za-z .'-]+[A-Za-z])((?:19|20)\d{2}\s+\S.*)$/);
 if(match&&match[1].includes(' ')&&looksLikeName(match[1])&&bookingDetailsSchema.shape.vehicle.safeParse(match[2]).success){
  return [match[1],match[2]];
 }
}

function contactParts(message:string) {
 const lines=message.split(/[;；\r\n]+/).flatMap(line=>line.split(labelSeparator));
 return lines.flatMap(line=>{
  // Notes can contain natural language punctuation. Only another explicit label ends them.
  const label=line.trim().match(labelledDetail);
  if(label&&detailLabels[label[1].toLowerCase()]==='notes')return [line.trim()];
  return line.split(/[,，]/).flatMap(chunk=>{
   const pieces=chunk.split(/([/／])/);
   const parts:string[]=[];
   let current=pieces[0].trim();
   for(let index=1;index<pieces.length;index+=2){
    const next=pieces[index+1].trim();
    const nextContact=contactKind(next);
    const shortPhone=contactKind(current)==='vehicle'&&/^\d{3,7}$/.test(next);
    const independentName=bookingName(next)&&next.includes(' ')&&
     (contactKind(current)!=='vehicle'||/\s[/／]\s/.test(chunk));
    const timingWord=todayWords.test(next)||tomorrowWords.test(next)||weekdayWords.test(next);
    const airConditioning=/\ba$/i.test(current)&&/^c\b/i.test(next);
    if(!airConditioning&&(nextContact||shortPhone||labelledDetail.test(next)||independentName||timingWord)){
     if(current)parts.push(current);
     current=next;
    }else{
     // Keep ambiguous slashes together, including 11/20 and model descriptors like 4WD/AWD.
     current+=pieces[index]+next;
    }
   }
   if(current)parts.push(current);
   return parts.flatMap(part=>compactNameAndVehicle(part)??[part]);
  });
 });
}

export function extractBooking(message:string,previous:BookingDraft={},today=todaySydney()){
 const draft:BookingDraft={...previous};
 const answer=message.trim();
 const expected=previous.awaiting;
 const capturedFields = new Set<BookingField>();
 const invalidFields = new Set<BookingField>();
 function capture(field:BookingField,value:string, reportInvalid=true) {
  const parsed=bookingDetailsSchema.shape[field].safeParse(field==='vehicle'?spaceVehicleYear(value):value);
  if(parsed.success){
   draft[field]=parsed.data;
   capturedFields.add(field);
   invalidFields.delete(field);
  }else if(reportInvalid)invalidFields.add(field);
 }

 const parts=contactParts(message);
 const labels=parts.map(part=>part.match(labelledDetail));
 const multiField=parts.length>1&&parts.some(part=>contactKind(part)||labelledDetail.test(part));
 const timingParts=parts.filter((part,index)=>!labels[index]&&!(multiField&&(contactKind(part)||bookingName(part))));
 const scheduleText=timingParts.join('\n').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'')
  .replace(/(\d)\s*([ap])\s*\.\s*m\.?(?![a-z])/gi,'$1$2m');
 const earliestRequested=wantsEarliestBooking(scheduleText);
 const shortTom=(expected!=='name'&&/^tom[.!?]*$/i.test(answer))||
  /\b(?:on|for|do) tom\b|\btom\s+(?:at|morning|afternoon|evening|\d)/i.test(scheduleText)||
  (bookingIntent(message)&&/\btom[.!?]*$/.test(answer));
 const tomorrow=tomorrowWords.test(scheduleText)||shortTom||/明天|明早|明晚|明晨/.test(scheduleText);
 let unclearDate=false,unclearTime=false;
 if(multiField){
  // A single unlabelled name can accompany recognizable contact or vehicle fields.
  const names=parts.filter(bookingName);
  const hasOtherDetail=parts.some((part,index)=>contactKind(part)||labels[index]&&!['name','notes'].includes(detailLabels[labels[index]![1].toLowerCase()]));
  if(names.length===1&&hasOtherDetail)capture('name',names[0]);
  for(const [index,part] of parts.entries()){
   const followsVehicle=index>0&&contactKind(parts[index-1])==='vehicle';
   const contact=contactKind(part)||(followsVehicle&&/^\d{3,7}$/.test(part)?'phone':undefined);
   if(contact)capture(contact,part);
  }
 }
 for(const label of labels){
  if(label)capture(detailLabels[label[1].toLowerCase()],label[2]);
 }
 const freeText=timingParts.join('\n');
 if(!capturedFields.has('email')&&!invalidFields.has('email')){
  const email=freeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if(email)capture('email',email[0],false);
 }
 if(!capturedFields.has('phone')&&!invalidFields.has('phone')){
  const phone=freeText.match(/(?:\+\d{1,3}[ ()-]*)?(?:\b0\d|\+\d)[\d ()-]{6,24}\d\b/);
  if(phone&&!/\d{4}-\d{2}-\d{2}/.test(phone[0]))capture('phone',phone[0],false);
 }
 if(!capturedFields.has('vehicle')&&!invalidFields.has('vehicle')){
  const vehicle=spaceVehicleYear(freeText).match(vehicleInText);
  if(vehicle)capture('vehicle',vehicle[1],false);
 }
 const explicit=scheduleText.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 const chinese=scheduleText.match(/(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})[日号]?/);
 const named=scheduleText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?\b/i)||scheduleText.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
 let parsedDate:string|undefined;
 if(explicit)parsedDate=explicit[0];
 else if(chinese)parsedDate=(chinese[1]||today.slice(0,4))+'-'+chinese[2].padStart(2,'0')+'-'+chinese[3].padStart(2,'0');
 else if(named){
  const dayFirst=/^\d/.test(named[1]);
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month=months.indexOf(named[dayFirst?2:1].slice(0,3).toLowerCase())+1;
  parsedDate=(named[3]||today.slice(0,4))+'-'+String(month).padStart(2,'0')+'-'+named[dayFirst?1:2].padStart(2,'0');
 }
 else if(/后天|後天|\bday after tomorrow\b/i.test(scheduleText))parsedDate=datePlus(today,2);
 else if(tomorrow)parsedDate=datePlus(today,1);
 else if(todayWords.test(scheduleText))parsedDate=today;
 else {
  const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const week=scheduleText.match(/\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const shortDay=scheduleText.match(datedWeekday)||
   (expected==='date'||expected==='time'||bookingIntent(scheduleText)?scheduleText.match(abbreviatedWeekday):null)||
   (expected!=='name'?scheduleText.trim().match(weekdayWithTime):null);
  const zh=scheduleText.match(/(下|本|这)?(?:周|週|星期)([日天一二三四五六])/);
  if(week||shortDay||zh){
   const englishDay=week?.[2]||shortDay?.[1];
   const target=englishDay?weekdays.findIndex(day=>day.startsWith(englishDay.toLowerCase())):'日一二三四五六'.indexOf(zh![2].replace('天','日'));
   const delta=(target-new Date(today+'T12:00:00Z').getUTCDay()+7)%7;
   parsedDate=datePlus(today,delta||7);
  }else if(/\b\d{1,2}[/-]\d{1,2}\b|next week|下周|下週|weekend|周末/i.test(scheduleText))unclearDate=true;
 }
 if(parsedDate)draft.date=parsedDate;
 const period=/\b(?:arvo|afternoon)\b|下午/.test(scheduleText.toLowerCase())||parsedDate&&/\bpm[.!? ]*$/i.test(scheduleText)&&!/\d\s*pm\b/i.test(scheduleText)
  ? 'afternoon' : /\b(?:morning|morn)\b|早上|上午|明早|明晨/.test(scheduleText.toLowerCase())||parsedDate&&/\bam[.!? ]*$/i.test(scheduleText)&&!/\d\s*am\b/i.test(scheduleText)
   ? 'morning' : undefined;
 const timeText=scheduleText.replace(/明早|明晨/g,'上午').replace(/明晚/g,'晚上').replace(/(上午|下午|早上|晚上)?([一二三四五六七八九十两]+)([点點])/g,(_,prefix,n,suffix)=>{const numbers:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};const value=n==='十'?10:n.includes('十')?(numbers[n.split('十')[0]]||1)*10+(numbers[n.split('十')[1]]||0):numbers[n];return (prefix||'')+(value||n)+suffix;});
 const clock=timeText.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)||timeText.match(/\b(\d{1,2}):([0-5]\d)\b/)||timeText.match(/(?:at\s+|上午|下午|早上|晚上)(\d{1,2})(?:点|點|时|時)?(?::([0-5]\d))?/i)||timeText.match(/(\d{1,2})(?:点|點|时|時)(半)?/);
 let parsedTime:string|undefined;
 if(clock){
  let hour=Number(clock[1]);
  const suffix=clock[3]?.toLowerCase();
  if(suffix){
   if(hour<1||hour>12)unclearTime=true;
   hour=hour%12+(suffix==='pm'?12:0);
  }else if((period==='afternoon'||/晚上|明晚/.test(scheduleText))&&hour<12)hour+=12;
  else if(hour<9&&period!=='morning'&&!/上午|早上|\d{1,2}:\d{2}/.test(clock[0]))unclearTime=true;
  if(hour>23)unclearTime=true;
  const minute=clock[2]==='半'?'30':clock[2]||'00';
  if(!unclearTime)parsedTime=String(hour).padStart(2,'0')+':'+minute;
 }
 if(!clock&&parsedDate){
  const shortHour=scheduleText.match(dayAndHour);
  if(shortHour){
   let hour=Number(shortHour[1]);
   if(period==='afternoon'&&hour>=1&&hour<12)hour+=12;
   if(hour>=9&&hour<=16)parsedTime=String(hour).padStart(2,'0')+':00';
   else unclearTime=true;
  }
 }
 const serviceText=scheduleText.trim();
 const service=/刹车|brake|\bbrks?\b/i.test(serviceText)?'brakes':/电瓶|battery|\bbatt\b/i.test(serviceText)?'battery':/轮胎|tyres?|tires?|alignment/i.test(serviceText)?'tyres':/空调|air.?con|\ba\/?c\b/i.test(serviceText)?'aircon':/故障|diagnostic|\b(?:diag|cel|dtc scan)\b/i.test(serviceText)?'diagnostic':/保养|oil|maintenance|\b(?:service|svc)\b/i.test(serviceText)?'service':null;
 if(service)draft.service=service;
 if(expected==='time'&&/^\d{1,2}$/.test(answer)){
  const hour=Number(answer);
  if(hour>=9&&hour<=16)parsedTime=String(hour).padStart(2,'0')+':00';
 }
 if(parsedTime)draft.time=parsedTime;
 else if(unclearTime||unclearDate||(parsedDate&&parsedDate!==previous.date&&!/\bsame time\b|同一时间|同樣時間|同样时间|同一時間/i.test(answer)))delete draft.time;
 if(unclearDate)delete draft.date;

 if(!capturedFields.has('name')&&!invalidFields.has('name')){
  const statedName=freeText.match(/\bmy name is\s+([A-Za-z][A-Za-z .'-]*?)(?=[,;\n]|$)/i);
  if(statedName)capture('name',statedName[1],false);
  else if(!parsedDate&&!parsedTime&&!earliestRequested){
   const introduction=freeText.match(/\b(?:i am|i'm)\s+([A-Za-z][A-Za-z .'-]*?)(?=[,;\n]|$)/i);
   if(introduction&&looksLikeName(introduction[1])&&!/^(?:busy|looking|wondering|ready)\b/i.test(introduction[1]))capture('name',introduction[1],false);
  }
 }

 // Timing changes, acknowledgements and questions do not fill personal fields.
 if(expected&&['name','email','phone','vehicle','notes'].includes(expected)&&
    !capturedFields.has(expected as BookingField)&&!invalidFields.has(expected as BookingField)&&!multiField&&
    !parsedDate&&!parsedTime&&!unclearDate&&!unclearTime&&!earliestRequested&&
    !bookingIntent(answer)&&!/[：:]/.test(answer)&&!/^(?:ok|yes|no|thanks|好的|可以)[.! ]*$/i.test(answer)){
  const field=expected as BookingField;
  if(field==='name'){
   if(looksLikeName(answer)||/^[\p{L} .'-]+$/u.test(answer)&&!bookingDetailsSchema.shape.name.safeParse(answer).success)capture(field,answer);
  }else if(field==='notes'||field==='email'&&!/\s/.test(answer)||field==='phone'&&/^[+\d ()-]+$/.test(answer)||field==='vehicle'&&!/[?？]/.test(answer)){
   capture(field,answer);
  }
 }

 return {
  draft:draftSchema.parse(draft),unclearDate,unclearTime,
  dateSpecified:!!parsedDate,timeSpecified:!!parsedTime,earliestRequested,
  period,
  capturedFields:[...capturedFields],invalidFields:[...invalidFields],
 };
}

export function consultationBookingContext(history:readonly {
 role:'user'|'assistant';
 text:string;
 service?:string;
 localBooking?:boolean;
}[]):Pick<BookingDraft,'vehicle'|'service'> {
 const recent=history.filter(message=>!message.localBooking).slice(-8).reverse();
 const suggested=recent.find(message=>message.role==='assistant')?.service;
 const service=services.some(item=>item.id===suggested)?suggested:undefined;
 for(const message of recent){
  if(message.role!=='user')continue;
  const {vehicle}=extractBooking(message.text).draft;
  if(vehicle)return {vehicle,service};
 }
 return {service};
}

export function bookingStatus(draft:BookingDraft,available:string[],lang:Lang,today=todaySydney(),intake?:{
 capturedFields:BookingField[];
 invalidFields:BookingField[];
 unclearTime?:boolean;
}){
 const t=(zh:string,en:string)=>lang==='zh'?zh:en;
 if(!draft.date){
  const example=datePlus(today,1);
  return {ready:false,awaiting:'date' as const,reply:t(
   `你想哪天到店？可以说“明天”“最早可约”，或输入日期，例如 ${example}。时间为悉尼当地时间。`,
   `What day works for you? Try “tomorrow”, “earliest available”, or a date like ${example}. Times are local to Sydney.`,
  )};
 }
 if(!available.length){
  const date=new Date(draft.date+'T12:00:00Z');
  let message=t(`${draft.date} 没有可用的到店时段。`,`There are no openings on ${draft.date}.`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==draft.date){
   message=t('这个日期无效。','That date is invalid.');
  }else if(draft.date<today){
   message=t(`${draft.date} 已经过去了。`,`${draft.date} has already passed.`);
  }else if(draft.date>datePlus(today,60)){
   message=t('目前可预约未来 60 天内的时段。','You can book up to 60 days ahead.');
  }else if(date.getUTCDay()===0){
   message=t(`${draft.date} 是周日，店铺当天不营业。`,`We’re closed on Sunday, ${draft.date}.`);
  }else if(draft.date===today){
   message=t('今天已没有可用的到店时段。','There are no check-in times left today.');
  }
  return {ready:false,awaiting:'date' as const,reply:message};
 }
 if(!draft.time||!validSlot(draft.date,draft.time)||!available.includes(draft.time)){
  const explanation=intake?.unclearTime?t('请注明上午或下午，例如“下午两点”。','Please specify am or pm, for example “2 pm”. ')
   :draft.time?t(`${draft.time} 不可预约。`,`${draft.time} isn’t available. `):'';
  return {ready:false,awaiting:'time' as const,reply:explanation+t(
   `${draft.date} 可在 ${available.join('、')} 到店（悉尼时间）。你想选几点？`,
   `On ${draft.date}, I can offer ${available.join(', ')} (Sydney time). Which time suits you?`,
  )};
 }
 if(!draft.service)return {ready:false,awaiting:'service' as const,reply:t('需要哪项服务：保养、刹车、电瓶、轮胎、空调或故障排查？','Which service: essential service, brakes, battery, tyres, air conditioning or diagnostics?')};
 const fields=['name','vehicle','email','phone'] as const;
 const labels={
  name:t('姓名','name'),vehicle:t('车辆资料','vehicle details'),
  email:t('邮箱','email address'),phone:t('电话号码','phone number'),notes:t('备注','notes'),
 };
 const examples={name:'Alex Smith',vehicle:'2020 Toyota Corolla',email:'alex@example.test',phone:'0491 570 006'};
 const questions={
  name:t('预约登记用哪个姓名？','What name should I put on the booking?'),
  vehicle:t('车辆的英文品牌、型号和年份是什么？','What is the vehicle’s make, model and year?'),
  email:t('你的邮箱地址是什么？','What is your email address?'),
  phone:t('你的联系电话是什么？','What is your contact phone number?'),
 };
 const missing=fields.filter(field=>!bookingDetailsSchema.shape[field].safeParse(draft[field]).success);
 const rejected=intake?.invalidFields[0];
 const next=rejected??(['vehicle','name','email','phone'] as const).find(field=>missing.includes(field));
 if(next==='notes'||(!next&&!bookingDetailsSchema.shape.notes.safeParse(draft.notes).success)){
  return {ready:false,awaiting:'notes' as const,reply:t(
   '备注请使用不超过 1000 个字符的文字，例如“低速刹车时有异响”。回复“notes:”可清空。',
   'Use up to 1,000 characters for notes. For example, “Squeaks when braking at low speed.” Send “notes:” to clear them.',
  )};
 }
 if(next){
  const saved=intake?.capturedFields.filter(field=>field!==next)??[];
  const savedList=new Intl.ListFormat(lang==='zh'?'zh-CN':'en-AU').format(saved.map(field=>labels[field]));
  const ack=saved.length?t(`已记录${savedList}。`,`I’ve kept the ${savedList}. `):'';
  const question=rejected?t(`${labels[next]}格式需要调整。`,`Please check the format of your ${labels[next]}. `):questions[next]+' ';
  const englishFields=next==='name'||next==='vehicle';
  const sample=englishFields
   ?t(`请用英文填写，例如“${examples[next]}”。`,`Use English characters, for example “${examples[next]}”.`)
   :t(`例如“${examples[next]}”。`,`For example, “${examples[next]}”.`);
  const combined=!rejected&&missing.length>1
   ?t(` 也可以一次填写多项，用斜线分隔，例如“${missing.map(field=>examples[field]).join(' / ')}”。`,
       ` You can also send multiple details together, separated by slashes. For example, “${missing.map(field=>examples[field]).join(' / ')}”.`)
   :'';
  return {ready:false,awaiting:next,reply:ack+question+sample+combined};
 }
 return {ready:true,reply:t('资料已准备好。请核对下面的预约卡并点击“确认预约”。现在尚未保存，时段也尚未锁定。','Your details are ready. Review the booking card and select Confirm booking. Nothing has been saved and the slot is not held yet.')};
}
