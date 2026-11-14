import {datePlus, serviceName, todaySydney, type Lang} from "./catalog";
import {bookingIntent, extractBooking} from "./conversation-booking";

export const adminInboxStorageKey = "harbour-admin-inbox-v1";
export const adminInboxEvent = "harbour-admin-inbox";
export const inboxLimit = 200;
export const emailCategories = ["appointment", "invoice", "quote", "general"] as const;
export type EmailCategory = typeof emailCategories[number];

export type InboxMessage = {
  id: string;
  sender: string;
  subject: string;
  body: string;
  received: string;
  category: EmailCategory;
  read: boolean;
  demo?: boolean;
  aiSummary?: string;
  draft?: string;
};

export function readAdminInbox(): InboxMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.sessionStorage.getItem(adminInboxStorageKey) ?? "[]");
    return Array.isArray(value) ? value.slice(0, inboxLimit) : [];
  } catch {
    return [];
  }
}

export function writeAdminInbox(messages: InboxMessage[]) {
  try {
    window.sessionStorage.setItem(adminInboxStorageKey, JSON.stringify(messages.slice(0, inboxLimit)));
    window.dispatchEvent(new Event(adminInboxEvent));
    return true;
  } catch {
    return false;
  }
}

export function classifyEmail(subject: string, body: string): EmailCategory {
  const title = subject.trim();
  const text = title + "\n" + body;
  if (bookingIntent(title) || /\b(?:appointment|reschedul\w*)\b|预约|預約/.test(title.toLowerCase())) return "appointment";
  if (/\binvoice\b|发票|發票/i.test(title)) return "invoice";
  if (/\b(?:quote|quotation|estimate)\b|报价|報價/i.test(title)) return "quote";
  if (bookingIntent(text) || /\b(?:appointment|reschedul\w*)\b|预约|預約/.test(text.toLowerCase())) return "appointment";
  if (/\binvoice\b|发票|發票/i.test(text)) return "invoice";
  if (/\b(?:quote|quotation|estimate)\b|报价|報價/i.test(text)) return "quote";
  return "general";
}

export function emailAppointment(message: InboxMessage) {
  try {
    return extractBooking(message.body + "\n" + message.subject, {}, message.received).draft;
  } catch {
    return {};
  }
}

export function emailHandoff(message: InboxMessage) {
  const slot = emailAppointment(message);
  return [slot.date, "Email: "+message.sender, message.body].filter(Boolean).join("\n").slice(0, 4000);
}

export function emailSummary(message: InboxMessage, lang: Lang) {
  if (message.aiSummary) return message.aiSummary;
  if (message.category === "appointment") {
    const slot = emailAppointment(message);
    const parts = [
      lang === "zh" ? "预约请求" : "Appointment request",
      slot.service ? serviceName(slot.service, lang) : "",
      slot.date,
      slot.time,
    ].filter(Boolean);
    if (parts.length > 1) return parts.join(" · ");
  }
  const text = message.body.trim().replace(/\s+/g, " ");
  return text.length > 134 ? text.slice(0, 133) + "…" : text;
}

export const emailGroups = ["today", "tomorrow", "yesterday", "week", "month", "quarter", "half", "year", "older"] as const;
export type EmailGroup = typeof emailGroups[number];

export function groupEmail(received: string, today: string): EmailGroup {
  if (received > today) return "tomorrow";
  if (received === today) return "today";
  if (received === datePlus(today, -1)) return "yesterday";
  if (received >= datePlus(today, -7)) return "week";
  if (received >= datePlus(today, -30)) return "month";
  if (received >= datePlus(today, -90)) return "quarter";
  if (received >= datePlus(today, -180)) return "half";
  return received >= datePlus(today, -365) ? "year" : "older";
}

export function demoEmails(): InboxMessage[] {
  const today = todaySydney();
  const weekday = new Date(today + "T12:00:00Z").getUTCDay();
  const saturday = datePlus(today, (6 - weekday + 7) % 7 || 7);
  return [
    {id:"demo-saturday",sender:"demo.lee@example.test",subject:"Appointment for Saturday at 5:30 pm?",
      body:"Hi, could I book a service on "+saturday+" at 5:30 pm?\n\nName: Demo Lee\nVehicle: 2021 Toyota Corolla\nPhone: 0491570006",
      category:"appointment",received:today,read:false,demo:true},
    {id:"demo-invoice",sender:"demo.parts@example.test",subject:"Invoice for brake pads",body:"Our invoice for the brake pads delivered this week is ready for your review.",category:"invoice",received:datePlus(today,-1),read:false,demo:true},
    {id:"demo-quote",sender:"demo.jules@example.test",subject:"Quote for air conditioning",body:"Could you give me a quote to inspect the air conditioning in a 2020 Hyundai i30?",category:"quote",received:datePlus(today,-4),read:false,demo:true},
    {id:"demo-general",sender:"demo.taylor@example.test",subject:"Thanks for your help",body:"Thank you for getting back to me about the workshop opening hours.",category:"general",received:datePlus(today,-11),read:true,demo:true},
  ];
}

export type SlotCheck = {state:"checking" | "available" | "clash" | "unknown"; times:string[]};

export function emailReplyDraft(category: EmailCategory, message: InboxMessage, lang: Lang, check?: SlotCheck) {
  const translate = (zh:string,en:string) => lang === "zh" ? zh : en;
  let paragraph = translate("感谢您联系 Harbour Auto。我们会查看您的邮件并尽快回复。","Thanks for contacting Harbour Auto. We’ll review your message and get back to you.");
  if (category === "invoice") {
    paragraph = translate("感谢您发送发票。我们会核对发票及相关订单，如需补充信息会与您联系。","Thanks for sending the invoice. We’ll check it against the order and get in touch if we need more information.");
  } else if (category === "quote") {
    paragraph = translate("感谢您询价。请确认车辆品牌、车型、年份及所需服务。最终报价以检查结果为准。","Thanks for requesting a quote. Please confirm your vehicle’s make, model, year and the work you need. We can confirm pricing after an inspection.");
  } else if (category === "appointment") {
    const {date,time} = emailAppointment(message);
    if (date && time && check?.state === "available") {
      paragraph = translate(date+" "+time+"（悉尼时间）目前可约。请回复确认是否合适，店铺会另行确认预约。",date+" at "+time+" (Sydney time) is currently available. Please let us know if this suits you and the workshop can confirm your appointment.");
    } else if (date && time && check?.state === "clash") {
      const times = check.times.slice(0,3);
      paragraph = translate(date+" "+time+"（悉尼时间）无法预约。",date+" at "+time+" (Sydney time) is unavailable.");
      paragraph += times.length
        ? translate(" 当天其他可选时段："+times.join("、")+"。请告诉我们您方便的时间。"," Other available times that day include "+times.join(", ")+". Please let us know what suits you.")
        : translate(" 请提供其他日期或时间，我们会再核对。"," Please send us another day or time and we’ll check availability.");
    } else {
      paragraph = translate("感谢您的预约请求。店铺会核对所需服务和到店时间，再与您确认。","Thanks for your appointment request. We’ll check the service and your preferred check-in time before confirming the booking.");
    }
  }
  return translate("您好，","Hello,")+"\n\n"+paragraph+"\n\n"+translate("Harbour Auto 团队","Harbour Auto team");
}
