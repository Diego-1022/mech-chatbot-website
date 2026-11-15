import {services,Lang} from "./catalog";
import {workshopContact} from "./workshop-info";

const vehicleNoise = /\b(?:nois(?:e|es|y)|scrap(?:e|es|ed|ing)|grind(?:s|ing)?|squeak(?:s|ing)?|squeal(?:s|ing)?|screech(?:es|ing)?|rattl(?:e|es|ing))\b|异响|異響|摩擦声|摩擦聲|刮擦|磨擦|尖叫声|尖叫聲/i;

export function symptomGuidance(message:string,lang:Lang,history:string[]=[]){
 const t=(zh:string,en:string)=>lang==="zh"?zh:en;
 const tyre=/\b(?:tyres?|tires?|tread|sidewall)\b|轮胎|輪胎|胎压|胎壓|胎面|胎侧|胎側/i.test(message);
 const tyreHazard=tyre&&/\b(?:blowout|bulg(?:e|es|ing)|exposed (?:cords?|wires?))\b|爆胎|鼓包|钢丝外露|鋼絲外露/i.test(message);
 const urgent=/\b(?:smok(?:e|ing)|fire|fuel (?:is )?leak(?:ing)?|overheat(?:s|ed|ing)?|brake (?:failure|warning light)|brakes? (?:failed|feel weak|stopped working))\b|失灵|失靈|冒烟|冒煙|着火|燃油泄漏|刹不住|煞不住|过热|過熱/i.test(message);
 if(tyreHazard||urgent)return {reply:t(
  "这些症状可能涉及行车安全。请在安全位置停车，停止驾驶并联系道路救援或合格维修人员。仅凭描述无法确认车辆是否适合继续行驶。",
  "This could be unsafe. Stop in a safe place, do not continue driving, and contact roadside assistance or a qualified technician. A description alone cannot confirm that the vehicle is safe.",
 ),service:null};

 const timingAnswer=/^(?:(?:yes|no)[, ]+)?(?:it\s+)?(?:(?:only|just|also|even|happens?|occurs?)\s+){0,2}(?:when|while|under|with)\b|^(?:只在|只有|一踩|踩|滑行时|滑行時)/i.test(message.trim());
 const braking=/\b(?:braking|brake pedal|hit the brakes|press(?:ing)? (?:the )?(?:brakes?|pedal)|apply(?:ing)? (?:the )?brakes?|step(?:ping)? on the (?:brake|pedal))\b|刹车|剎車|煞車|制动|制動/i.test(message);
 const coastingOnly=/\b(?:not|never|without)\s+(?:braking|(?:press(?:ing)?|touching) (?:the )?(?:brakes?|pedal))\b|\b(?:only|just) (?:(?:while|when|as) (?:i(?:[’']m)? )?)?coast(?:ing)?\b|没踩刹车|沒踩煞車|仅在滑行|僅在滑行/i.test(message);
 const noisy=vehicleNoise.test(message)||((timingAnswer||coastingOnly)&&vehicleNoise.test(history.at(-1)||""));
 const slowing=/\b(?:slow(?:s|ed|ing)? down|decelerat(?:e|es|ing|ion)|coming to a stop)\b|减速|減速|快停下/i.test(message);
 const scraping=/\b(?:scrap(?:e|es|ed|ing)|grind(?:s|ing)?|squeal(?:s|ing)?|screech(?:es|ing)?)\b|刮擦|磨擦|摩擦声|摩擦聲|尖叫声|尖叫聲/i.test(message);
 const tyreEvidence=tyre&&/\b(?:punctur(?:e|ed)|nail|flat|los(?:e|es|ing) (?:air|pressure)|low (?:tyre |tire )?pressure|pressure (?:keeps )?dropping|uneven wear|worn tread|tread (?:is )?(?:worn|uneven)|bald|sidewall cut)\b|扎钉|扎釘|漏气|漏氣|胎压低|胎壓低|磨损不均|磨損不均|胎面磨平/i.test(message);
 if(!coastingOnly&&((noisy&&braking)||(scraping&&slowing&&!tyreEvidence))){
  const advice=t(
   "建议先检查刹车系统和附近的车轮部位。仅凭异响无法判断轮胎是否需要更换。若刹车变弱、警示灯亮起或刮擦声很严重，请在安全位置停车并联系道路救援。",
   "A brake inspection is the first step. Have the brakes and nearby wheel area checked promptly. The noise alone doesn’t tell us whether you need new tyres. If braking feels weaker, a brake warning light comes on or the scraping is severe, stop safely and contact roadside assistance.",
  );
  const question=braking?"":t(" 声音只在踩刹车时出现，还是不踩刹车滑行时也有？"," Does it happen only when you press the brake pedal, or also when coasting?");
  return {reply:advice+question,service:"brakes"};
 }
 if(tyreEvidence)return {reply:t(
  "建议先检查轮胎。维修人员需要查看胎压、胎面和胎侧状况，再判断是否可以修补或需要更换。若轮胎已完全瘪掉或正在快速漏气，请安全停车并联系道路救援。",
  "A tyre inspection is the right starting point. A technician can check its pressure, tread and sidewall before advising on repair or replacement. If it’s fully flat or losing air rapidly, stop safely and contact roadside assistance.",
 ),service:"tyres"};
 if(noisy&&(tyre||coastingOnly))return {reply:t(
  "仅凭声音无法确定是否来自轮胎，也不能判断是否需要更换。建议先做故障排查，检查车轮和附近部件。声音是否随车速变化？",
  "The sound alone doesn’t identify the source or establish that the tyres need replacing. Start with a diagnostic inspection of the wheel area. Does the noise change with vehicle speed?",
 ),service:"diagnostic"};
 return null;
}

export function assistantReply(message:string,lang:Lang,history:string[]=[],catalogue=services){
 const t=(z:string,e:string)=>lang==="zh"?z:e; const m=message.toLowerCase(); const all=[...history.slice(-5),message].join(" ").toLowerCase();
 const guidance=symptomGuidance(message,lang,history);
 if(guidance)return guidance;
 if(/营业|几点|opening|hours|周末/.test(m))return{reply:t("营业时间：周一至周五 09:00–17:00，周六 09:00–12:00，周日休息。预约可全天提交，所有时段按悉尼当地时间显示。预约时间是到店接待时间，不代表维修完成时间。","Opening hours: Mon–Fri 09:00–17:00, Sat 09:00–12:00, closed Sunday. Book online anytime; all appointments use Sydney local time. The appointment is a drop-off/check-in time, not a promised completion time.")};
 if(/地址|电话|address|phone|location|contact/.test(m))return{reply:t("地址："+workshopContact.location+"，"+workshopContact.address+"。联系电话："+workshopContact.phone+"。也可以直接使用网页上的在线预约。","Find us at "+workshopContact.location+", "+workshopContact.address+". Contact: "+workshopContact.phone+". You can also book your visit online.")};
 let id=/刹车|brake|制动|\bbrks?\b/.test(all)?"brakes":/电瓶|启动|打不着|battery|start|\bbatt\b/.test(all)?"battery":/轮胎|定位|tyre|tire|align/.test(all)?"tyres":/空调|air.?con|cooling|\ba\/?c\b/.test(all)?"aircon":/故障灯|异响|抖动|warning|noise|vibrat|engine|\b(?:diag|cel|dtc scan)\b/.test(all)?"diagnostic":/保养|机油|service|oil|\bsvc\b/.test(all)?"service":undefined;
 if(/预约|booking|book|appointment/.test(m))return{reply:t("可以。点击下方“安排预约”，选择服务、日期和空闲时段，填写资料后会先展示确认摘要。只有提交成功后才会生成预约编号。","Yes. Choose “Book a visit” below, select a service, date and available time, then review your details. Your booking number is created only after the reservation is saved."),service:id||"diagnostic",book:true};
 const s=catalogue.find(x=>x.id===id);
 if(s){const reasons:Record<string,string[]>={brakes:["刹车异响可能与刹车片磨损或刹车盘状态有关，需要检查确认。","Brake noise can relate to pad wear or rotor condition; inspection is needed."],battery:["启动困难可能涉及电瓶、接线、启动机或充电系统，需要检测区分。","Starting difficulty may involve the battery, connections, starter or charging system; testing is needed."],tyres:["跑偏或轮胎不均匀磨损可能与胎压、定位或悬挂有关。","Pulling or uneven wear may relate to tyre pressure, alignment or suspension."],aircon:["制冷不足可能涉及制冷剂泄漏、压缩机或风道，需要检查。","Weak cooling may relate to a refrigerant leak, compressor or airflow; inspection is needed."],service:["常规保养的具体项目取决于车型、里程和厂商保养计划。","Service items depend on your vehicle, mileage and manufacturer schedule."],diagnostic:["故障灯、异响或抖动可能有多种原因，需要现场检查，不能仅凭描述确定故障。","Warning lights, noise and vibration have several possible causes; an in-person inspection is needed."]};
 const pricing=t("参考价格区间：A$ "+s.min+"–"+s.max+"（"+s.zh+"）。具体项目、零件与人工需检查后确认；故障排查价格不包含后续维修。","Indicative estimate: A$ "+s.min+"–"+s.max+" for "+s.en.toLowerCase()+". Parts, labour and scope require inspection; diagnostic pricing excludes subsequent repairs.");
 return {reply:reasons[s.id][lang==="zh"?0:1]+"\n\n"+pricing+"\n\n"+t("请补充品牌／车型、年份，以及症状在什么时候出现？这是初步服务建议，具体原因需到店检查。","What is the make/model and year, and when does the symptom occur? This is initial service guidance; an inspection is needed to identify the cause."),service:s.id};}
 return {reply:t("我可以介绍服务、参考价格和营业时间，并带你完成预约。请描述车辆症状，例如“刹车有异响”或“车辆无法启动”，也可以询问“保养多少钱”。具体故障需要到店检查确认。","I can explain services, indicative prices and opening hours, and help you book. Describe a symptom such as brake noise or trouble starting, or ask about service pricing. An in-person inspection is needed for a diagnosis.")};
}
