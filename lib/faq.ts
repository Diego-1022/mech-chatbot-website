import {services,type Lang} from "./catalog";
import {assistantReply} from "./assistant";

// Only unambiguous standard questions bypass the model. Symptoms and follow-ups
// still use the AI path; no model or external service is involved in these replies.
export function quickReply(message:string,lang:Lang,history:string[]=[]){
 const m=message.trim().toLowerCase().replace(/[?？!！.。]+$/g,"").trim();
 const isHours=/^(opening hours|hours|what are your opening hours|when are you open|营业时间|几点营业|周末营业吗)$/.test(m);
 const isContact=/^(address|phone|location|contact|what is your address|地址|电话|联系方式)$/.test(m);
 const isBooking=/^(book a visit|book a service|book an appointment|i want to book|我要预约|我想预约|预约)$/.test(m);
 if(isHours||isContact||isBooking)return {...assistantReply(message,lang,history),mode:"guide" as const,reason:"faq"};
 const priceOnly=/^(service prices|service price|how much is a service|保养多少钱|保养价格)$/.test(m);
 if(!priceOnly)return null;
 const s=services[0];
 return {reply:lang==="zh"?"常规保养包括机油与滤芯更换和基础车辆检查。下方为参考价格，具体项目、零件与人工需到店检查后确认。":"Essential service includes an oil and filter change and basic vehicle checks. The card shows an indicative estimate; final scope, parts and labour are confirmed after inspection.",service:s.id,mode:"guide" as const,reason:"faq",estimate:{min:s.min,max:s.max,currency:"AUD",service:s.id}};
}
