import {z} from 'zod';
import {datePlus,todaySydney,services,validSlot,type Lang} from './catalog';
import {bookingDetailsSchema} from './booking-input';
export const draftSchema=z.object({awaiting:z.enum(['date','time','service','vehicle','name','email','phone','notes']).optional(),service:z.enum(services.map(s=>s.id) as [string,...string[]]).optional(),date:z.string().max(10).optional(),time:z.string().max(5).optional(),name:z.string().max(80).optional(),email:z.string().max(150).optional(),phone:z.string().max(30).optional(),vehicle:z.string().max(120).optional(),notes:z.string().max(1000).optional()});
export type BookingDraft=z.infer<typeof draftSchema>;
const tomorrowWords = /\b(?:tomorrow|tmr|tmrw|tmro|tmw)\b/i;
const todayWords = /今天|今日|\btoday\b/i;

export function wantsEarliestBooking(text:string) {
 return /\b(?:asap|a\.s\.a\.p|as soon as possible|(?:earliest|soonest|first|next)\s+(?:available|opening|appointment|slot|time))\b|尽快|儘快|越快越好|最早(?:的)?(?:时段|時段|时间|時間|预约|預約)?/i.test(text);
}

export function bookingIntent(text:string) {
 if(/取消|改期|cancel|reschedul/i.test(text))return false;
 if(/预约|預約|\bbook(?:ing)?\b|\bappointment\b/i.test(text))return true;
 const timing=tomorrowWords.test(text)||todayWords.test(text)||/\btom\b|明天|明早|明晨|明晚/i.test(text);
 const scheduling=/\b(?:can we do|let(?:'|’)s do|lets do|fit me in|can i come in)\b/i.test(text);
 return (timing&&scheduling)||
  (wantsEarliestBooking(text)&&/\b(?:fix|repair|come in|fit me in|available (?:slot|time)|check[- ]?in)\b|修车|修車|到店/i.test(text));
}

export function extractBooking(message:string,previous:BookingDraft={},today=todaySydney()){
 const draft:BookingDraft={...previous};
 const answer=message.trim();
 const expected=previous.awaiting;
 const scheduleText=message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'');
 const earliestRequested=wantsEarliestBooking(scheduleText);
 const shortTom=(expected!=='name'&&/^tom[.!?]*$/i.test(answer))||
  /\b(?:on|for|do) tom\b|\btom\s+(?:at|morning|afternoon|evening|\d)/i.test(scheduleText)||
  (bookingIntent(message)&&/\btom[.!?]*$/.test(answer));
 const tomorrow=tomorrowWords.test(scheduleText)||shortTom||/明天|明早|明晚|明晨/.test(scheduleText);
 let unclearDate=false,unclearTime=false;
 const parts=message.split(/[;；\n]+/);
 const keys:Record<string,'name'|'email'|'phone'|'vehicle'|'notes'>={name:'name',姓名:'name',email:'email',邮箱:'email',phone:'phone',电话:'phone',vehicle:'vehicle',car:'vehicle',车辆:'vehicle',notes:'notes',备注:'notes'};
 for(const part of parts){const match=/^\s*(name|姓名|email|邮箱|phone|电话|vehicle|car|车辆|notes|备注)\s*[:：]\s*(.*?)\s*$/i.exec(part);if(match)draft[keys[match[1].toLowerCase()]]=match[2];}
 const email=message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);if(email)draft.email=email[0];
 const phone=message.match(/(?:\+\d{1,3}[ ()-]*)?(?:\b0\d|\+\d)[\d ()-]{6,24}\d\b/);if(phone&&!/\d{4}-\d{2}-\d{2}/.test(phone[0]))draft.phone=phone[0].trim();
 const vehicle=message.match(/\b((?:19|20)\d{2}\s+(?:Toyota|Honda|Mazda|Ford|BMW|Audi|Mercedes|Porsche|Hyundai|Kia|Nissan|Tesla|Volkswagen|Subaru|Holden|Lexus|Suzuki|Mitsubishi)\s+[A-Za-z0-9 -]+?)(?=[,;.\n]|\s+(?:and|with|at|for|on|tomorrow|tmr|tmrw|tmro|tmw)\b|$)/i);if(vehicle)draft.vehicle=vehicle[1].trim();
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
  const zh=scheduleText.match(/(下|本|这)?(?:周|週|星期)([日天一二三四五六])/);
  if(week||zh){
   const target=week?weekdays.indexOf(week[2].toLowerCase()):'日一二三四五六'.indexOf(zh![2].replace('天','日'));
   const delta=(target-new Date(today+'T12:00:00Z').getUTCDay()+7)%7;
   parsedDate=datePlus(today,delta||7);
  }else if(/\b\d{1,2}[/-]\d{1,2}\b|next week|下周|下週|weekend|周末/i.test(scheduleText))unclearDate=true;
 }
 if(parsedDate)draft.date=parsedDate;
 const timeText=scheduleText.replace(/明早|明晨/g,'上午').replace(/明晚/g,'晚上').replace(/(上午|下午|早上|晚上)?([一二三四五六七八九十两]+)([点點])/g,(_,prefix,n,suffix)=>{const numbers:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};const value=n==='十'?10:n.includes('十')?(numbers[n.split('十')[0]]||1)*10+(numbers[n.split('十')[1]]||0):numbers[n];return (prefix||'')+(value||n)+suffix;});
 const clock=timeText.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)||timeText.match(/\b(\d{1,2}):([0-5]\d)\b/)||timeText.match(/(?:at\s+|上午|下午|早上|晚上)(\d{1,2})(?:点|點|时|時)?(?::([0-5]\d))?/i)||timeText.match(/(\d{1,2})(?:点|點|时|時)(半)?/);
 let parsedTime:string|undefined;
 if(clock){
  let hour=Number(clock[1]);
  const suffix=clock[3]?.toLowerCase();
  if(suffix){
   if(hour<1||hour>12)unclearTime=true;
   hour=hour%12+(suffix==='pm'?12:0);
  }else if(/下午|晚上|明晚/.test(message)&&hour<12)hour+=12;
  else if(hour<9&&!/上午|早上|\d{1,2}:\d{2}/.test(clock[0]))unclearTime=true;
  if(hour>23)unclearTime=true;
  const minute=clock[2]==='半'?'30':clock[2]||'00';
  if(!unclearTime)parsedTime=String(hour).padStart(2,'0')+':'+minute;
 }
 const service=/刹车|brake/i.test(message)?'brakes':/电瓶|battery/i.test(message)?'battery':/轮胎|tyres?|tires?|alignment/i.test(message)?'tyres':/空调|air.?con/i.test(message)?'aircon':/保养|oil|maintenance|\bservice\b/i.test(message)&&!/diagnostic/i.test(message)?'service':/故障|diagnostic/i.test(message)?'diagnostic':null;if(service)draft.service=service;
 if(expected==='time'&&/^\d{1,2}$/.test(answer)){
  const hour=Number(answer);
  if(hour>=9&&hour<=16)parsedTime=String(hour).padStart(2,'0')+':00';
 }
 if(parsedTime)draft.time=parsedTime;
 else if(unclearTime||unclearDate||(parsedDate&&parsedDate!==previous.date&&!/\bsame time\b|同一时间|同樣時間|同样时间|同一時間/i.test(answer)))delete draft.time;
 if(unclearDate)delete draft.date;

 const statedName=message.match(/\bmy name is\s+([A-Za-z][A-Za-z .'-]*?)(?=[,;\n]|$)/i);
 if(statedName)draft.name=statedName[1].trim();
 else if(!parsedDate&&!parsedTime&&!earliestRequested) {
  const introduction=message.match(/\b(?:i am|i'm)\s+([A-Za-z][A-Za-z .'-]*?)(?=[,;\n]|$)/i);
  if(introduction&&!/^(?:available|free|busy|looking|wondering|ready)\b/i.test(introduction[1]))draft.name=introduction[1].trim();
 }

 // A new timing preference is not an answer to a name or vehicle question.
 if(expected&&['name','email','phone','vehicle','notes'].includes(expected)&&
    !parsedDate&&!parsedTime&&!unclearDate&&!unclearTime&&!earliestRequested&&
    !bookingIntent(answer)&&!/[：:]/.test(answer)&&!/^(?:ok|yes|no|thanks|好的|可以)[.! ]*$/i.test(answer)){
  const field=expected as 'name'|'email'|'phone'|'vehicle'|'notes';
  if(bookingDetailsSchema.shape[field].safeParse(answer).success)draft[field]=answer;
 }
 return {
  draft:draftSchema.parse(draft),unclearDate,unclearTime,
  dateSpecified:!!parsedDate,timeSpecified:!!parsedTime,earliestRequested,
 };
}

export function bookingStatus(draft:BookingDraft,available:string[],lang:Lang,today=todaySydney()){
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
  const explanation=draft.time?t(`${draft.time} 不可预约。`,`${draft.time} isn’t available. `):'';
  return {ready:false,awaiting:'time' as const,reply:explanation+t(
   `${draft.date} 可在 ${available.join('、')} 到店（悉尼时间）。你想选几点？`,
   `On ${draft.date}, I can offer ${available.join(', ')} (Sydney time). Which time suits you?`,
  )};
 }
 if(!draft.service)return {ready:false,awaiting:'service' as const,reply:t('需要哪项服务：保养、刹车、电瓶、轮胎、空调或故障排查？','Which service: essential service, brakes, battery, tyres, air conditioning or diagnostics?')};
 const prompts={vehicle:['请告诉我车辆的英文品牌、车型和年份，例如“2020 Toyota Camry”。','What is your vehicle make, model and year? For example, 2020 Toyota Camry.'],name:['请问怎么称呼你？直接输入英文姓名即可。','What name should I put on the booking? Just type your name.'],email:['你的邮箱是什么？直接输入邮箱即可。','What is your email address? Just type the address.'],phone:['你的联系电话是什么？直接输入号码即可。','What is your contact phone number? Just type the number.']};
 for(const field of ['vehicle','name','email','phone'] as const){if(!bookingDetailsSchema.shape[field].safeParse(draft[field]).success)return {ready:false,awaiting:field,reply:prompts[field][lang==='zh'?0:1]+t(' 已提供的资料会保留，姓名和车辆资料请使用英文。',' Your other details are retained. Use English for names and vehicle details.')};}
 if(!bookingDetailsSchema.safeParse({...draft,notes:draft.notes||''}).success)return {ready:false,awaiting:'notes' as const,reply:t('请输入不超过 1000 字符的正常文本备注，或回复“notes:”清空。','Provide plain text notes (up to 1,000 characters), or reply "notes:" to clear them.')};
 return {ready:true,reply:t('资料已准备好。请核对下面的预约卡并点击“确认预约”。现在尚未保存，时段也尚未锁定。','Your details are ready. Review the booking card and select Confirm booking. Nothing has been saved and the slot is not held yet.')};
}
