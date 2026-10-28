import assert from 'node:assert/strict';
import {bookingDetailsSchema,bookingFieldErrors,hasNonEnglishBookingText} from '../lib/booking-input.ts';
let checks=0;
const check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS '+name)};
const valid={name:"Mary-Jane O'Connor",email:'mary@example.com',phone:'+61 (2) 9385-1000',vehicle:'Toyota Corolla 2020',notes:'Brake noise at 50 km/h.'};
check('Valid formatted details accepted',bookingDetailsSchema.safeParse(valid).success);
for(const phone of ['0400000000','02 9999 9999','93851000','+44 20 7946 0958','12345678','+123456789012345'])check('Supported phone '+phone,bookingDetailsSchema.safeParse({...valid,phone}).success);
const invalid=[['phone','------'],['phone','      '],['phone','123'],['phone','1234567'],['phone','1234567890123456'],['phone','++61412345678'],['phone','04+12345678'],['vehicle','  '],['vehicle',' X '],['email','a@b'],['email','invalid-email'],['name','   '],['name','Alex123'],['name','José'],['notes','x'.repeat(1001)]];
for(const [field,value] of invalid){const result=bookingDetailsSchema.safeParse({...valid,[field]:value});check('Rejects '+field+' '+JSON.stringify(value.slice(0,30)),!result.success);if(!result.success)check('Error attached to '+field,!!bookingFieldErrors(result.error)[field]);}
const parsed=bookingDetailsSchema.parse({...valid,name:'  Alex  ',email:' mary@example.com ',phone:'  0400000000  ',vehicle:' Toyota Corolla 2020 ',notes:'  noise  '});
check('Surrounding whitespace normalized consistently',parsed.name==='Alex'&&parsed.email==='mary@example.com'&&parsed.phone==='0400000000'&&parsed.vehicle==='Toyota Corolla 2020'&&parsed.notes==='noise');
check('Optional notes default to empty',bookingDetailsSchema.parse({...valid,notes:undefined}).notes==='');
check('Vehicle lower boundary accepted',bookingDetailsSchema.safeParse({...valid,vehicle:'XY'}).success);
check('Vehicle upper boundary accepted',bookingDetailsSchema.safeParse({...valid,vehicle:'X'.repeat(120)}).success);
check('Vehicle length above boundary rejected',!bookingDetailsSchema.safeParse({...valid,vehicle:'X'.repeat(121)}).success);
for(const [key,value] of [['name','王明'],['vehicle','トヨタ'],['phone','０４１２３４５６７８'],['notes','Check engine 😮']])check('English policy preserved for '+key,hasNonEnglishBookingText({...valid,[key]:value}));

if(process.argv[2]){
 const target=new URL(process.argv[2]);assert.ok(['localhost','127.0.0.1'].includes(target.hostname),'Local integration only');
 const root=target.origin;
 async function post(body){const response=await fetch(root+'/api/workshop',{method:'POST',headers:{Origin:root,'Content-Type':'application/json'},body:JSON.stringify(body)});return {response,data:await response.json()}}
 const {todaySydney,datePlus}=await import('../lib/catalog.ts');let date=datePlus(todaySydney(),1),time;
 for(let day=0;day<7;day++){const response=await fetch(root+'/api/workshop?action=availability&date='+date);const body=await response.json();if(body.times?.length){time=body.times[0];break;}date=datePlus(date,1);}
 assert.ok(time,'isolated test DB needs an available slot');
 const identity=()=>({requestId:crypto.randomUUID(),token:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')});
 for(const [field,value] of [['phone','------'],['phone','04+12345678'],['vehicle','  '],['email','a@b']]){
  const body={action:'create',...valid,service:'service',date,time,...identity(),[field]:value};
  const result=await post(body);check('API rejects '+field+' '+JSON.stringify(value),result.response.status===400&&result.data.error==='INVALID_INPUT');
  const missing=await fetch(root+'/api/workshop?action=booking&id='+body.requestId,{headers:{Authorization:'Bearer '+body.token}});check('Rejected '+field+' does not create a booking',missing.status===404);
 }
 const body={action:'create',...valid,phone:' 0400000000 ',vehicle:' Toyota Corolla 2020 ',service:'service',date,time,...identity()};
 let result=await post(body);check('Valid booking persists locally',result.response.status===201&&result.data.booking.phone==='0400000000'&&result.data.booking.vehicle==='Toyota Corolla 2020');
 result=await post(body);check('Retry remains idempotent',result.response.ok&&result.data.booking.id===body.requestId);
 const lookup=await fetch(root+'/api/workshop?action=booking&id='+body.requestId,{headers:{Authorization:'Bearer '+body.token}});check('Private lookup still works',lookup.ok&&(await lookup.json()).booking.id===body.requestId);
 const cancelled=await fetch(root+'/api/workshop',{method:'POST',headers:{Origin:root,'Content-Type':'application/json',Authorization:'Bearer '+body.token},body:JSON.stringify({action:'cancel',id:body.requestId})});check('Synthetic booking can be cancelled',cancelled.ok);
}
console.log(`${checks} booking validation checks passed. Integration targets are local only.`);
