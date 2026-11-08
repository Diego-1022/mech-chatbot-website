import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['lib/conversation-booking.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {extractBooking,bookingStatus,bookingIntent}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
let n=0;const check=(name,value)=>{assert.ok(value,name);n++;console.log('PASS '+name)};
const today='2026-11-06';
for(const [input,date,time] of [['Book brakes tomorrow at 10am','2026-11-07','10:00'],['帮我预约下周一上午十点','2026-11-09','10:00'],['Book 2026-11-10 at 2pm','2026-11-10','14:00'],['Book 10 November at 13:00','2026-11-10','13:00'],['November 10 at 11am','2026-11-10','11:00'],['11月10日下午两点','2026-11-10','14:00'],['the day after tomorrow at 9am','2026-11-08','09:00']]){const {draft}=extractBooking(input,{},today);check(input,draft.date===date&&draft.time===time)}
check('Tomorrow morning shorthand',extractBooking('我想预约明早十点给我的2020年凯美瑞保养 可以吗',{},today).draft.date==='2026-11-07'&&extractBooking('我想预约明早十点给我的2020年凯美瑞保养 可以吗',{},today).draft.time==='10:00');
check('Bare name answers current question',extractBooking('Diego Hu',{awaiting:'name'},today).draft.name==='Diego Hu');
check('Single first name accepted',extractBooking('Diego',{awaiting:'name'},today).draft.name==='Diego');
check('Bare international phone accepted when requested',extractBooking('61412345678',{awaiting:'phone'},today).draft.phone==='61412345678');
check('No arbitrary name guess outside name question',!extractBooking('Diego Hu',{},today).draft.name);
check('Booking command does not become a name',!extractBooking('I would like to book',{awaiting:'name'},today).draft.name);
check('Booking intent detected',bookingIntent('I would like to book tomorrow'));
check('Cancel is not new booking intent',!bookingIntent('cancel my booking'));
check('Ambiguous numeric dates not guessed',!extractBooking('book 11/12 at 10am',{},today).draft.date);
check('Ambiguous short hour cleared',!extractBooking('at 2',{},today).draft.time);
let d=extractBooking('name: Alex Smith; email: alex@example.com; phone: 0412345678; vehicle: 2016 Toyota Corolla; notes: Brake squeak',{service:'brakes',date:'2026-11-10',time:'10:00'},today).draft;
check('Labelled details collected',d.name==='Alex Smith'&&d.vehicle==='2016 Toyota Corolla'&&d.phone==='0412345678');
check('Corrections retain unrelated fields',extractBooking('vehicle: 2017 Toyota Corolla',d,today).draft.email===d.email);
check('Explicit vehicle correction applied',extractBooking('vehicle: 2017 Toyota Corolla',d,today).draft.vehicle==='2017 Toyota Corolla');
const {nextBookingDate}=await import('../lib/catalog.ts');d.date=nextBookingDate();
check('Ready only with all details and real availability',bookingStatus(d,['10:00'],'en').ready);
const chineseNotes = extractBooking('备注：刹车有声音', d, today).draft;
check('Chinese notes retained and ready for review',chineseNotes.notes==='刹车有声音'&&bookingStatus(chineseNotes,['10:00'],'zh').ready);
check('Slot taken never marked ready',!bookingStatus(d,['11:00'],'en').ready);
check('Invalid contact rejected',!bookingStatus({...d,phone:'-----'},['10:00'],'en').ready);
check('Model alone cannot reach review',bookingStatus({...d,vehicle:'Corolla'},['10:00'],'en').awaiting==='vehicle');
check('English booking policy retained',!bookingStatus({...d,vehicle:'丰田'},['10:00'],'zh').ready);
check('Impossible dates rejected',!bookingStatus({...d,date:'2026-11-31'},['10:00'],'en').ready);
check('Conversation vehicle captured',extractBooking('I have a 2016 Toyota Corolla, with brake noise',{},today).draft.vehicle==='2016 Toyota Corolla');
console.log(`${n} conversation extraction checks passed.`);

if(process.argv[2]){
 const root=new URL(process.argv[2]);assert.ok(['127.0.0.1','localhost'].includes(root.hostname));
 const post=async(action,data={})=>{const response=await fetch(root.origin+'/api/workshop',{method:'POST',headers:{Origin:root.origin,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});return {status:response.status,data:await response.json()}};
 const {todaySydney,datePlus}=await import('../lib/catalog.ts');let date=datePlus(todaySydney(),1),time;
 for(let i=0;i<7;i++){const result=await fetch(root.origin+'/api/workshop?action=availability&date='+date).then(r=>r.json());if(result.times.length){time=result.times[0];break}date=datePlus(date,1)}
 assert.ok(time);d={...d,date,time};
 let r=await post('prepareBooking',{message:`Book brakes ${date} at ${time}`,draft:{},lang:'en',customerId:null});check('API checks availability and asks missing info',r.status===200&&!r.data.bookingReady&&r.data.available.includes(time));
 r=await post('prepareBooking',{message:'Please review',draft:d,lang:'en',customerId:null});check('Complete draft reaches confirmation',r.status===200&&r.data.bookingReady);
 const identity={requestId:crypto.randomUUID(),token:'a'.repeat(64)};
 r=await post('create',{...d,...identity,expectedCustomerId:'another-account'});check('Session switch blocks save',r.status===409);
 r=await post('create',{...d,...identity,expectedCustomerId:null});check('Confirmed details persist',r.status===201);
 r=await post('create',{...d,...identity,expectedCustomerId:null});check('Retry creates no duplicate',r.status===200);
 r=await post('prepareBooking',{message:'Please review',draft:d,lang:'zh',customerId:null});check('Taken slot rechecked on preparation',!r.data.bookingReady&&!r.data.available.includes(time));
 const cancelled=await fetch(root.origin+'/api/workshop',{method:'POST',headers:{Origin:root.origin,'Content-Type':'application/json',Authorization:'Bearer '+identity.token},body:JSON.stringify({action:'cancel',id:identity.requestId})});check('Synthetic test booking cleaned up',cancelled.ok);
 r=await post('prepareBooking',{message:'Brake failure, please book tomorrow',draft:d,lang:'en',customerId:null});check('Urgent safety response wins over booking',!r.data.bookingReady&&r.data.reply.includes('Stop'));
 r=await post('prepareBooking',{message:'Please review',draft:d,lang:'en',customerId:'forged'});check('Forged customer context rejected',r.status===409);
 console.log(`${n} total conversation checks passed; localhost only, no AI calls.`);
}
