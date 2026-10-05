export type Lang = "zh" | "en";
export const services=[
{id:"service",zh:"常规保养",en:"Essential service",detailZh:"机油与滤芯更换 · 基础车辆检查",detailEn:"Oil & filter change · essential checks",min:180,max:320,icon:"oil"},
{id:"brakes",zh:"刹车检查与维修",en:"Brakes & safety",detailZh:"刹车系统检查 · 按检查结果报价",detailEn:"Brake inspection · repair quoted after checks",min:80,max:650,icon:"brake"},
{id:"battery",zh:"电瓶与启动系统",en:"Battery & starting",detailZh:"电瓶检测 · 启动与充电系统检查",detailEn:"Battery testing · starting & charging checks",min:40,max:380,icon:"battery"},
{id:"diagnostic",zh:"故障排查",en:"Vehicle diagnostics",detailZh:"故障灯读取 · 症状与系统检查",detailEn:"Warning lights · symptom & system checks",min:90,max:180,icon:"scan"},
{id:"tyres",zh:"轮胎与定位",en:"Tyres & alignment",detailZh:"轮胎检查 · 定位与更换建议",detailEn:"Tyre checks · alignment & replacement advice",min:80,max:280,icon:"tyre"},
{id:"aircon",zh:"空调检查",en:"Air conditioning",detailZh:"制冷效果检查 · 泄漏与系统排查",detailEn:"Cooling performance · system diagnosis",min:100,max:250,icon:"air"}
];
export const times=["09:00","10:00","11:00","13:00","14:00","15:00","16:00"];
export function todaySydney(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function datePlus(date:string,n:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function serviceName(id:string,lang:Lang){const s=services.find(x=>x.id===id);return s?.[lang]||id;}
export function validSlot(date:string,time:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!times.includes(time))return false;const d=new Date(date+"T12:00:00Z");if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return false;const today=todaySydney();if(date<today||date>datePlus(today,60)||d.getUTCDay()===0)return false;if(d.getUTCDay()===6&&time>="13:00")return false;if(date===today){const now=new Intl.DateTimeFormat("en-GB",{timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());if(time<=now)return false;}return true;}
