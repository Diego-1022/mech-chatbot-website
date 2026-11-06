import {z} from 'zod';
import {datePlus,todaySydney,services,validSlot,type Lang} from './catalog';
import {bookingDetailsSchema} from './booking-input';
export const draftSchema=z.object({service:z.enum(services.map(s=>s.id) as [string,...string[]]).optional(),date:z.string().max(10).optional(),time:z.string().max(5).optional(),name:z.string().max(80).optional(),email:z.string().max(150).optional(),phone:z.string().max(30).optional(),vehicle:z.string().max(120).optional(),notes:z.string().max(1000).optional()});
export type BookingDraft=z.infer<typeof draftSchema>;
export const bookingIntent=(text:string)=>/预约|預約|\bbook(?:ing)?\b|\bappointment\b/i.test(text)&&!/取消|改期|cancel|reschedul/i.test(text);
export function extractBooking(message:string,previous:BookingDraft={},today=todaySydney()){
 const draft:BookingDraft={...previous};let unclearDate=false,unclearTime=false;
 const parts=message.split(/[;；\n]+/);
 const keys:Record<string,keyof BookingDraft>={name:'name',姓名:'name',email:'email',邮箱:'email',phone:'phone',电话:'phone',vehicle:'vehicle',car:'vehicle',车辆:'vehicle',notes:'notes',备注:'notes'};
 for(const part of parts){const match=/^\s*(name|姓名|email|邮箱|phone|电话|vehicle|car|车辆|notes|备注)\s*[:：]\s*(.*?)\s*$/i.exec(part);if(match)draft[keys[match[1].toLowerCase()]]=match[2];}
 const email=message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);if(email)draft.email=email[0];
 const phone=message.match(/(?:\+\d{1,3}[ ()-]*)?(?:\b0\d|\+\d)[\d ()-]{6,24}\d\b/);if(phone&&!/\d{4}-\d{2}-\d{2}/.test(phone[0]))draft.phone=phone[0].trim();
 const name=message.match(/(?:my name is|i am|i'm)\s+([A-Za-z][A-Za-z .'-]*?)(?=[,;\n]|$)/i);if(name)draft.name=name[1].trim();
 const vehicle=message.match(/\b((?:19|20)\d{2}\s+(?:Toyota|Honda|Mazda|Ford|BMW|Audi|Mercedes|Porsche|Hyundai|Kia|Nissan|Tesla|Volkswagen|Subaru|Holden|Lexus|Suzuki|Mitsubishi)\s+[A-Za-z0-9 -]+?)(?=[,;.\n]|\s+(?:and|with|at|for|on|tomorrow)\b|$)/i);if(vehicle)draft.vehicle=vehicle[1].trim();
 const explicit=message.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 const chinese=message.match(/(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})[日号]?/);
 const named=message.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?\b/i)||message.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
 if(explicit)draft.date=explicit[0];
 else if(chinese)draft.date=`${chinese[1]||today.slice(0,4)}-${chinese[2].padStart(2,'0')}-${chinese[3].padStart(2,'0')}`;
 else if(named){const dayFirst=/^\d/.test(named[1]),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const month=months.indexOf(named[dayFirst?2:1].slice(0,3).toLowerCase())+1;draft.date=`${named[3]||today.slice(0,4)}-${String(month).padStart(2,'0')}-${named[dayFirst?1:2].padStart(2,'0')}`;}
 else if(/后天|後天|day after tomorrow/i.test(message))draft.date=datePlus(today,2);
 else if(/明天|tomorrow/i.test(message))draft.date=datePlus(today,1);
 else if(/今天|today/i.test(message))draft.date=today;
 else {const week=message.match(/\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);const zh=message.match(/(下|本|这)?(?:周|週|星期)([日天一二三四五六])/);if(week||zh){const target=week?['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(week[2].toLowerCase()):'日一二三四五六'.indexOf(zh![2].replace('天','日'));let delta=(target-new Date(today+'T12:00:00Z').getUTCDay()+7)%7;if(!delta)delta=7;draft.date=datePlus(today,delta);}else if(/\b\d{1,2}[/-]\d{1,2}\b|next week|下周|下週|weekend|周末/.test(message))unclearDate=true;}
 const timeText=message.replace(/(上午|下午|早上|晚上)?([一二三四五六七八九十两]+)([点點])/g,(_,prefix,n,suffix)=>{const numbers:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};const value=n==='十'?10:n.includes('十')?(numbers[n.split('十')[0]]||1)*10+(numbers[n.split('十')[1]]||0):numbers[n];return (prefix||'')+(value||n)+suffix;});
 const clock=timeText.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)||timeText.match(/\b(\d{1,2}):([0-5]\d)\b/)||timeText.match(/(?:at\s+|上午|下午|早上|晚上)(\d{1,2})(?:点|點|时|時)?(?::([0-5]\d))?/i)||timeText.match(/(\d{1,2})(?:点|點|时|時)(半)?/);
 if(clock){let hour=Number(clock[1]);const suffix=clock[3]?.toLowerCase();if(suffix){if(hour<1||hour>12)unclearTime=true;hour=hour%12+(suffix==='pm'?12:0)}else if(/下午|晚上/.test(message)&&hour<12)hour+=12;else if(hour<9&&!/上午|早上|\d{1,2}:\d{2}/.test(clock[0]))unclearTime=true;const minute=clock[2]==='半'?'30':clock[2]||'00';if(hour>23)unclearTime=true;draft.time=`${String(hour).padStart(2,'0')}:${minute}`;}
 const service=/刹车|brake/i.test(message)?'brakes':/电瓶|battery/i.test(message)?'battery':/轮胎|tyres?|tires?|alignment/i.test(message)?'tyres':/空调|air.?con/i.test(message)?'aircon':/保养|oil|essential service|routine service/i.test(message)?'service':/故障|diagnostic/i.test(message)?'diagnostic':null;if(service)draft.service=service;
 if(unclearDate)delete draft.date;if(unclearTime)delete draft.time;
 return {draft:draftSchema.parse(draft),unclearDate,unclearTime};
}
export function bookingStatus(draft:BookingDraft,available:string[],lang:Lang){
 const t=(zh:string,en:string)=>lang==='zh'?zh:en;
 if(!draft.date)return {ready:false,reply:t('你想预约哪一天？请提供明确日期（如 2026-11-10），也可以说“明天”或“下周一”。所有时间为悉尼时间。','Which date would you like? Use an exact date (e.g. 2026-11-10), tomorrow or a weekday. All times are Sydney local time.')};
 if(!available.length)return {ready:false,reply:t(`${draft.date} 已约满、已过期或不营业，请选择其他日期。`,`${draft.date} has no available check-in slots (closed, past or fully booked). Please choose another date.`)};
 if(!draft.time||!validSlot(draft.date,draft.time)||!available.includes(draft.time))return {ready:false,reply:t(`该时间尚未选定或不可用。${draft.date} 可用时段：${available.join('、')}。请告诉我你选择的时间。`,`That time is missing or unavailable. Available on ${draft.date}: ${available.join(', ')}. Which time would you like?`)};
 if(!draft.service)return {ready:false,reply:t('需要哪项服务：保养、刹车、电瓶、轮胎、空调或故障排查？','Which service: essential service, brakes, battery, tyres, air conditioning or diagnostics?')};
 for(const field of ['vehicle','name','email','phone'] as const){if(!bookingDetailsSchema.shape[field].safeParse(draft[field]).success)return {ready:false,reply:t(`请提供有效的 ${field}，例如“${field}: ${ {vehicle:'2016 Toyota Corolla',name:'Alex Smith',email:'alex@example.com',phone:'0412345678'}[field]}”。预约资料须使用英文字符。已提供的其他资料会保留。`,`Please provide a valid ${field}, e.g. "${field}: ${ {vehicle:'2016 Toyota Corolla',name:'Alex Smith',email:'alex@example.com',phone:'0412345678'}[field]}". Booking details use English characters. Your other details are retained.`)};}
 if(!bookingDetailsSchema.safeParse({...draft,notes:draft.notes||''}).success)return {ready:false,reply:t('请用英文字符提供不超过 1000 字符的备注，或回复“notes:”清空。','Provide notes in English characters (up to 1,000), or reply "notes:" to clear them.')};
 return {ready:true,reply:t('资料已准备好。请核对下面的预约卡并点击“确认预约”。现在尚未保存，时段也尚未锁定。','Your details are ready. Review the booking card and select Confirm booking. Nothing has been saved and the slot is not held yet.')};
}
