import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['lib/conversation-booking.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {extractBooking,bookingStatus,bookingIntent,wantsEarliestBooking,consultationBookingContext}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
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
const {nextBookingDate,todaySydney}=await import('../lib/catalog.ts');d.date=nextBookingDate();
check('Ready only with all details and real availability',bookingStatus(d,['10:00'],'en').ready);
const chineseNotes = extractBooking('备注：刹车有声音', d, today).draft;
check('Chinese notes retained and ready for review',chineseNotes.notes==='刹车有声音'&&bookingStatus(chineseNotes,['10:00'],'zh').ready);
check('Slot taken never marked ready',!bookingStatus(d,['11:00'],'en').ready);
check('Invalid contact rejected',!bookingStatus({...d,phone:'-----'},['10:00'],'en').ready);
check('Model alone cannot reach review',bookingStatus({...d,vehicle:'Corolla'},['10:00'],'en').awaiting==='vehicle');
check('English booking policy retained',!bookingStatus({...d,vehicle:'丰田'},['10:00'],'zh').ready);
check('Impossible dates rejected',!bookingStatus({...d,date:'2026-11-31'},['10:00'],'en').ready);
check('Conversation vehicle captured',extractBooking('I have a 2016 Toyota Corolla, with brake noise',{},today).draft.vehicle==='2016 Toyota Corolla');
const screenshotDay='2026-11-15';
const existing={date:screenshotDay,time:'10:00',name:'Alex Smith',vehicle:'2016 Toyota Corolla'};
check('Today in a conversational booking request',bookingIntent('can we do today')&&extractBooking('can we do today',{},screenshotDay).draft.date===screenshotDay);
for(const input of ["let's do tmr",'lets do tmrw','Book brakes tmro at 10am','tom','Can we do tom at 11am?']){
 const result=extractBooking(input,{...existing,awaiting:'date'},screenshotDay);
 check('Sydney tomorrow shorthand: '+input,result.dateSpecified&&result.draft.date==='2026-11-16'&&result.draft.name===existing.name&&result.draft.vehicle===existing.vehicle);
}
const dateCorrection=extractBooking("let's do tmr",{...existing,awaiting:'name'},screenshotDay);
check('Date correction clears stale time and does not overwrite name',dateCorrection.draft.time===undefined&&dateCorrection.draft.name===existing.name);
check('I am free tomorrow does not overwrite a saved name',extractBooking('I am free tomorrow',existing,screenshotDay).draft.name===existing.name);
check('Explicit name and date can be supplied together',extractBooking('My name is Tom; tmr at 10am',existing,screenshotDay).draft.name==='Tom');
check('Same time can be carried over explicitly',extractBooking('tmr same time',existing,screenshotDay).draft.time===existing.time);
check('New explicit timing replaces old timing together',extractBooking('tmrw at 3pm',existing,screenshotDay).draft.time==='15:00');
check('Bare Tom as a name preserves the selected date',extractBooking('Tom',{...existing,awaiting:'name'},screenshotDay).draft.name==='Tom'&&extractBooking('Tom',{...existing,awaiting:'name'},screenshotDay).draft.date===existing.date);
check('Bare Tom email user does not affect the selected date',extractBooking('tom@example.test',{...existing,awaiting:'email'},screenshotDay).draft.date===existing.date);
check('ASAP repair phrase enters the booking flow',bookingIntent('i want to fix it asap')&&wantsEarliestBooking('i want to fix it asap'));
check('ASAP does not count inherited date and time as user constraints',(()=>{const result=extractBooking('i want to fix it asap',{...existing,awaiting:'name'},screenshotDay);return result.earliestRequested&&!result.dateSpecified&&!result.timeSpecified&&result.draft.name===existing.name;})());
check('ASAP can be constrained to an explicit date',(()=>{const result=extractBooking('earliest available tmr',existing,screenshotDay);return result.earliestRequested&&result.dateSpecified&&result.draft.date==='2026-11-16';})());
check('Chinese ASAP wording is recognised',wantsEarliestBooking('我想尽快预约'));

const chosenSlot={date:nextBookingDate(),time:'10:00',service:'brakes'};
const testName='Alex Smith';
const testVehicle='2020 Toyota Corolla';
const testEmail='alex@example.test';
const testPhone='0491 570 006';
const slashDetails=testName+' / '+testVehicle+' / '+testPhone;
const combinedIntake=extractBooking(slashDetails,{...chosenSlot,awaiting:'vehicle'},today);
const {draft:combined}=combinedIntake;
check('Three slash-delimited details are captured without labels',
 combined.name===testName&&combined.vehicle===testVehicle&&combined.phone===testPhone);
check('Combined details preserve chosen date, time and service',
 combined.date===chosenSlot.date&&combined.time===chosenSlot.time&&combined.service===chosenSlot.service);
for(const lang of ['en','zh']){
 const status=bookingStatus(combined,['10:00'],lang,todaySydney(),combinedIntake);
 check('Only the missing email is requested with a safe example in '+lang,
  status.awaiting==='email'&&status.reply.includes(testEmail)&&!status.reply.includes(testPhone)&&!status.reply.includes(testVehicle));
}
const chineseCombined=extractBooking(
 '姓名：'+testName+' ／ 车辆：'+testVehicle+' ／ 电话：'+testPhone,
 {...chosenSlot,awaiting:'vehicle'},today,
).draft;
check('Chinese labels and full-width separators accept valid booking details',
 chineseCombined.name===testName&&chineseCombined.vehicle===testVehicle&&chineseCombined.phone===testPhone);
const nameAndVehicle=extractBooking(testName+'/'+testVehicle,{...chosenSlot,awaiting:'vehicle'},today).draft;
check('No-space name and vehicle are parsed as two details',
 nameAndVehicle.name===testName&&nameAndVehicle.vehicle===testVehicle&&nameAndVehicle.phone===undefined);
const nameAndPhone=extractBooking(testName+'/0491570006',{...chosenSlot,awaiting:'name'},today).draft;
check('No-space name and phone are parsed as two details',
 nameAndPhone.name===testName&&nameAndPhone.phone==='0491570006'&&nameAndPhone.vehicle===undefined);
const mixedLabels=extractBooking(testName+' / phone: '+testPhone,{awaiting:'name'},today).draft;
check('A plain name and labelled phone work in a single reply',mixedLabels.name===testName&&mixedLabels.phone===testPhone);
const compactDetails=extractBooking(testName+testVehicle,{...chosenSlot,awaiting:'vehicle'},today).draft;
check('A run-together name and year-first vehicle are recognised',
 compactDetails.name===testName&&compactDetails.vehicle===testVehicle);
const exactDateDetails=extractBooking('2026-11-10 at 10am / '+slashDetails,{service:'brakes'},today).draft;
check('An exact booking date and time remain parseable with slash-delimited details',
 exactDateDetails.date==='2026-11-10'&&exactDateDetails.time==='10:00'&&exactDateDetails.name===testName&&exactDateDetails.phone===testPhone);
const relativeDateDetails=extractBooking('明天上午十点 / '+slashDetails,{service:'brakes'},today).draft;
check('A relative booking date and time remain parseable with slash-delimited details',
 relativeDateDetails.date==='2026-11-07'&&relativeDateDetails.time==='10:00'&&relativeDateDetails.name===testName&&relativeDateDetails.vehicle===testVehicle);
const weekdayDetails=extractBooking('Monday / '+slashDetails,{},today).draft;
check('A weekday attached to personal details is parsed as a date',
 weekdayDetails.date==='2026-11-09'&&weekdayDetails.name===testName&&weekdayDetails.vehicle===testVehicle);
check('A slash between numeric date parts is still treated as ambiguous',
 extractBooking('11/12 at 10am / '+slashDetails,{},today).unclearDate);
const invalidPhone=extractBooking(testName+' / '+testVehicle+' / phone: 123',{...chosenSlot,email:testEmail,awaiting:'phone'},today).draft;
check('Invalid phone keeps valid fields and asks for a phone',
 invalidPhone.name===testName&&invalidPhone.vehicle===testVehicle&&invalidPhone.email===testEmail&&bookingStatus(invalidPhone,['10:00'],'en').awaiting==='phone');
const shortPhone=extractBooking(testName+'/'+testVehicle+'/123',{...chosenSlot,email:testEmail,awaiting:'name'},today);
check('Too-short phone in a combined reply is reported and other fields stay valid',
 shortPhone.invalidFields.includes('phone')&&shortPhone.draft.name===testName&&shortPhone.draft.vehicle===testVehicle);
const invalidEmail=extractBooking(testName+' / '+testVehicle+' / 邮箱：alex@',{...chosenSlot,phone:testPhone,awaiting:'email'},today).draft;
check('Invalid email keeps valid fields and asks for an email',
 invalidEmail.name===testName&&invalidEmail.vehicle===testVehicle&&invalidEmail.phone===testPhone&&bookingStatus(invalidEmail,['10:00'],'zh').awaiting==='email');
const complete=extractBooking(testEmail,{...combined,awaiting:'email'},today).draft;
check('A plain email finishes the otherwise complete slash-delimited booking',
 complete.email===testEmail&&bookingStatus(complete,['10:00'],'en').ready);
const corrections=extractBooking('phone: 123 / email: alex@',complete,today);
check('Invalid contact corrections do not overwrite earlier valid contacts',
 corrections.invalidFields.includes('email')&&corrections.invalidFields.includes('phone')&&
 corrections.draft.email===testEmail&&corrections.draft.phone===testPhone);
const badEmail=extractBooking('邮箱：alex@',complete,today);
const badEmailStatus=bookingStatus(badEmail.draft,['10:00'],'zh',todaySydney(),badEmail);
check('A rejected email correction still prompts for a valid email in Chinese',
 !badEmailStatus.ready&&badEmailStatus.awaiting==='email'&&badEmailStatus.reply.includes('邮箱格式')&&badEmailStatus.reply.includes(testEmail));
const badPhone=extractBooking('phone: 123',complete,today);
const badPhoneStatus=bookingStatus(badPhone.draft,['10:00'],'en',todaySydney(),badPhone);
check('A rejected phone correction still prompts for a valid phone in English',
 !badPhoneStatus.ready&&badPhoneStatus.awaiting==='phone'&&badPhoneStatus.reply.includes('format of your phone number')&&badPhoneStatus.reply.includes(testPhone));
check('English notes preserve a slash within the note',
 extractBooking('notes: Intermittent / after rain',complete,today).draft.notes==='Intermittent / after rain');
const notesAndPhone=extractBooking('备注：低速时 / 下雨后 / 电话：'+testPhone,combined,today).draft;
check('Chinese note preserves the slash and accepts a subsequent labelled contact',
 notesAndPhone.notes==='低速时 / 下雨后'&&notesAndPhone.phone===testPhone&&notesAndPhone.name===testName);
check('Slash in a vehicle modifier is preserved',
 extractBooking(testVehicle+' 4WD/AWD',{awaiting:'vehicle'},today).draft.vehicle===testVehicle+' 4WD/AWD');
check('An unrelated pricing question is not used as a name',
 !extractBooking('Can you tell me the price?',{awaiting:'name'},today).draft.name);
check('Unaffected plain vehicle and phone answers still work',
 extractBooking(testVehicle,{awaiting:'vehicle'},today).draft.vehicle===testVehicle&&
 extractBooking(testPhone,{awaiting:'phone'},today).draft.phone===testPhone);
const compactConsultation='my car is 2020toyota corolla and idk waht happend my car squeaks when i brake lightly';
const compactVehicle=extractBooking(compactConsultation,{},today).draft;
check('Compact year and make in the reported consultation are recognised',compactVehicle.vehicle.toLowerCase()==='2020 toyota corolla');
const compactSlash=extractBooking('Alex Smith / 2020toyota corolla / 0491570006',{awaiting:'name'},today).draft;
check('Compact vehicle also works with slash-delimited contacts',compactSlash.name===testName&&compactSlash.vehicle.toLowerCase()==='2020 toyota corolla'&&compactSlash.phone==='0491570006');
const savedPhotoConsultation=[
 {role:'user',text:compactConsultation,imageCount:1},
 {role:'assistant',text:'A brake inspection may be helpful.',service:'brakes'},
];
const recovered=consultationBookingContext(savedPhotoConsultation);
check('Restored consultation carries vehicle and suggested service without needing the image',recovered.vehicle===compactVehicle.vehicle&&recovered.service==='brakes');
check('The latest stated vehicle wins over the earlier one and assistant examples are ignored',consultationBookingContext([
 ...savedPhotoConsultation,{role:'user',text:'Actually, it is my 2022 Mazda CX-5.'},
 {role:'assistant',text:'For example, 2018 Toyota Corolla.'},
]).vehicle==='2022 Mazda CX-5');
check('Empty consultation or local-only booking turns do not supply a vehicle',!consultationBookingContext([]).vehicle&&!consultationBookingContext([
 {role:'user',text:compactConsultation,localBooking:true},
]).vehicle);
const reviewWithRecoveredVehicle=bookingStatus({...chosenSlot,...recovered},['10:00'],'en');
check('Restored vehicle skips the make/model/year prompt and asks for name',reviewWithRecoveredVehicle.awaiting==='name');
const compactAppointment=extractBooking('appt for a/c tues arvo',{},screenshotDay);
check('Appointment, service, weekday and Australian afternoon shorthand combine naturally',
 bookingIntent('appt for a/c tues arvo')&&compactAppointment.draft.service==='aircon'&&
 compactAppointment.draft.date==='2026-11-17'&&compactAppointment.period==='afternoon'&&!compactAppointment.draft.time);
const weekdayClock=extractBooking('Can we do Tues. at 2 p.m.?',{},screenshotDay);
check('Conversational abbreviated weekday and dotted PM parse together',
 bookingIntent('Can we do Tues. at 2 p.m.?')&&weekdayClock.draft.date==='2026-11-17'&&weekdayClock.draft.time==='14:00');
check('Weekday followed by an unambiguous opening hour is accepted',
 extractBooking('tues 10',{awaiting:'date'},screenshotDay).draft.time==='10:00');
const ambiguousHour=extractBooking('tmr 2',{date:'2026-11-16',time:'10:00',awaiting:'time'},screenshotDay);
check('Bare 2 is clarified instead of reusing a previous time',
 ambiguousHour.draft.date==='2026-11-16'&&ambiguousHour.unclearTime&&!ambiguousHour.draft.time);
const compactMorning=extractBooking('appt 2moro am',{},screenshotDay);
check('Tomorrow and morning shorthand are both retained',
 compactMorning.draft.date==='2026-11-16'&&compactMorning.period==='morning');
check('Common service aliases match a booking service',
 extractBooking('batt',{awaiting:'service'},screenshotDay).draft.service==='battery'&&
 extractBooking('diag',{awaiting:'service'},screenshotDay).draft.service==='diagnostic'&&
 extractBooking('svc',{awaiting:'service'},screenshotDay).draft.service==='service');
check('An abbreviated weekday inside a customer name is not a scheduling change',
 extractBooking('Alex Sun',{awaiting:'name',date:'2026-11-16'},screenshotDay).draft.name==='Alex Sun'&&
 extractBooking('Alex Sun',{awaiting:'name',date:'2026-11-16'},screenshotDay).draft.date==='2026-11-16');
console.log(`${n} conversation extraction checks passed.`);

if(process.argv[2]){
 const root=new URL(process.argv[2]);assert.ok(['127.0.0.1','localhost'].includes(root.hostname));
 const post=async(action,data={})=>{const response=await fetch(root.origin+'/api/workshop',{method:'POST',headers:{Origin:root.origin,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});return {status:response.status,data:await response.json()}};
 const {datePlus}=await import('../lib/catalog.ts');let date=datePlus(todaySydney(),1),time;
 const now=todaySydney();
 const initial=await post('prepareBooking',{message:'can we do today',draft:{service:'brakes',vehicle:'2020 Toyota Corolla'},lang:'en',customerId:null});
 check('Conversational today selects the Sydney date',initial.status===200&&initial.data.bookingDraft.date===now);
 if(new Date(now+'T12:00:00Z').getUTCDay()===0)check('Sunday names the closure and offers another real opening',initial.data.reply.includes('closed on Sunday')&&initial.data.reply.includes('next available options'));
 const earliest=await post('prepareBooking',{message:'i want to fix it asap',draft:initial.data.bookingDraft,lang:'en',customerId:null});
 check('ASAP replaces stale timing with an available appointment',earliest.status===200&&earliest.data.available.includes(earliest.data.bookingDraft.time)&&earliest.data.reply.includes('earliest check-in'));
 const earliestDay=await fetch(root.origin+'/api/workshop?action=availability&date='+earliest.data.bookingDraft.date).then(response=>response.json());
 check('ASAP does not reserve the suggested slot',earliestDay.times.includes(earliest.data.bookingDraft.time));
 const tomorrow=await post('prepareBooking',{message:'lets do tmr',draft:earliest.data.bookingDraft,lang:'en',customerId:null});
 check('Tomorrow shorthand selects tomorrow and retains vehicle and service',tomorrow.status===200&&tomorrow.data.bookingDraft.date===datePlus(now,1)&&tomorrow.data.bookingDraft.vehicle==='2020 Toyota Corolla'&&tomorrow.data.bookingDraft.service==='brakes');
 for(let i=0;i<7;i++){const result=await fetch(root.origin+'/api/workshop?action=availability&date='+date).then(r=>r.json());if(result.times.length){time=result.times[0];break}date=datePlus(date,1)}
 assert.ok(time);d={...d,date,time};
 let r=await post('prepareBooking',{message:`Book brakes ${date} at ${time}`,draft:{},lang:'en',customerId:null});check('API checks availability and asks missing info',r.status===200&&!r.data.bookingReady&&r.data.available.includes(time));
 const partial=await post('prepareBooking',{message:slashDetails,draft:r.data.bookingDraft,lang:'en',customerId:null});
 check('API accepts combined details and asks only for email',partial.status===200&&partial.data.bookingDraft.awaiting==='email'&&partial.data.bookingDraft.name===testName&&partial.data.bookingDraft.vehicle===testVehicle&&partial.data.bookingDraft.phone===testPhone&&partial.data.bookingDraft.date===date&&partial.data.bookingDraft.time===time&&partial.data.reply.includes(testEmail));
 const filled=await post('prepareBooking',{message:testEmail,draft:partial.data.bookingDraft,lang:'zh',customerId:null});
 check('API plain email completes the combined-detail booking',filled.status===200&&filled.data.bookingReady&&filled.data.bookingDraft.email===testEmail);
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
