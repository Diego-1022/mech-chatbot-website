import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasNonEnglishBookingText, validEnglishDetails } from '../lib/booking-input.ts';
import { commentInput, makeCommentCursor, parseCommentCursor } from '../lib/comments-contract.ts';

let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log('PASS ' + name); }
const valid = {name:"Mary-Jane O'Connor",email:'mary@example.com',phone:'+61 (2) 9385-1000',vehicle:'Toyota Corolla 2020 - 1.8L',notes:"Brake noise at 50 km/h.\nStarted 2 days ago."};
check('English names, numbers, punctuation and phone format accepted', validEnglishDetails(valid));
for (const [field, value] of [['name','王明'],['vehicle','トヨタ'],['notes','发动机异响'],['email','用户@example.com'],['phone','０４１２３４５６７８'],['notes','Check engine 😮']]) check('Non-English '+field+' rejected',hasNonEnglishBookingText({...valid,[field]:value}));
check('Accented names follow English-letter restriction',!validEnglishDetails({...valid,name:'José'}));
check('Digits are not allowed in names',!validEnglishDetails({...valid,name:'Alex123'}));
const id = crypto.randomUUID();
check('Public comments allow Chinese, Japanese and emoji',commentInput.safeParse({requestId:id,name:'访客',message:'谢谢！テスト 😊'}).success);
check('HTML-looking comment remains plain text data',commentInput.parse({requestId:id,message:'<script>alert(1)</script>'}).message==='<script>alert(1)</script>');
check('Empty comments rejected',!commentInput.safeParse({requestId:id,message:'  '}).success);
check('Long comments rejected',!commentInput.safeParse({requestId:id,message:'x'.repeat(1001)}).success);
check('Bot honeypot rejected',!commentInput.safeParse({requestId:id,message:'hello',website:'https://spam.example'}).success);
check('Control characters rejected',!commentInput.safeParse({requestId:id,message:'a\u0000b'}).success);
const row={id,name:'',message:'test',created_at:new Date().toISOString()};
check('Cursor round trip',parseCommentCursor(makeCommentCursor(row)).id===id);
check('Malformed cursor rejected',(()=>{try{parseCommentCursor('invalid%%%');return false;}catch{return true;}})());

if (process.argv[2]) {
 const origin = new URL(process.argv[2]);
 assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'Integration checks are local-only.');
 const credentials=Object.fromEntries(readFileSync('dist/server/.dev.vars','utf8').trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),JSON.parse(line.slice(i+1))];}));
 async function request(path,body,options={}) {const response=await fetch(origin.origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin.origin}:{}),...options.headers},body:body?JSON.stringify(body):undefined});return {response,data:await response.json()};}
 const one={action:'create',requestId:crypto.randomUUID(),name:'Local check',message:'留言保存检查 / テスト / 😊 / <script>alert(1)</script>'};
 let result=await request('/api/comments',one);check('Comment saved',result.response.status===201&&result.data.comment.message===one.message);
 const retry=await request('/api/comments',one);check('Retry returns original message',retry.response.ok&&retry.data.comment.id===one.requestId);
 const concurrent={action:'create',requestId:crypto.randomUUID(),name:'',message:'Concurrent request check'};
 const duplicates=await Promise.all([request('/api/comments',concurrent),request('/api/comments',concurrent)]);check('Concurrent submits return one ID',duplicates.every(r=>r.response.ok&&r.data.comment.id===concurrent.requestId));
 result=await request('/api/comments');check('Saved comments survive GET',result.data.comments.some(c=>c.id===one.requestId));check('Public payload omits moderation state',result.data.comments.every(c=>!('status' in c)));
 result=await request('/api/comments?scope=admin');check('Anonymous admin list rejected',result.response.status===403);
 result=await request('/api/comments',{action:'moderate',id:one.requestId,status:'hidden'});check('Anonymous moderation rejected',result.response.status===403);
 result=await request('/api/comments',{...one,requestId:crypto.randomUUID()},{headers:{Origin:'https://other.example'}});check('Cross-origin posting rejected',result.response.status===403);
 result=await request('/api/comments',{...one,requestId:crypto.randomUUID(),website:'spam'});check('Honeypot rejected by server',result.response.status===400);
 result=await request('/api/comments',{...one,requestId:crypto.randomUUID(),message:'x'.repeat(1001)});check('Server length limit enforced',result.response.status===400);
 result=await request('/api/comments?cursor=not%25valid');check('Invalid pagination cursor rejected',result.response.status===400);
 const auth=await request('/api/admin-session',{password:credentials.ADMIN_PASSWORD});check('Local administrator session created',auth.response.ok);
 const cookie=auth.response.headers.get('set-cookie').split(';')[0];
 const adminHeaders={Cookie:cookie};
 result=await request('/api/comments',{action:'moderate',id:one.requestId,status:'hidden'},{headers:adminHeaders});check('Admin can hide comment',result.response.ok);
 result=await request('/api/comments');check('Hidden comment omitted publicly',!result.data.comments.some(c=>c.id===one.requestId));
 result=await request('/api/comments?scope=admin',null,{headers:adminHeaders});check('Admin can see hidden state',result.data.comments.some(c=>c.id===one.requestId&&c.status==='hidden'));
 result=await request('/api/comments',{action:'moderate',id:one.requestId,status:'visible'},{headers:adminHeaders});check('Admin can restore comment',result.response.ok);
 result=await request('/api/comments');check('Restored comment visible',result.data.comments.some(c=>c.id===one.requestId));
 let limited=false;
 for(let i=0;i<4;i++){const r=await request('/api/comments',{...one,requestId:crypto.randomUUID(),message:'Rate check '+i});if(r.response.status===429){limited=true;break;}}
 check('Posting rate limit enforced',limited);
 const localDay=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00Z');localDay.setUTCDate(localDay.getUTCDate()+1);if(localDay.getUTCDay()===0)localDay.setUTCDate(localDay.getUTCDate()+1);
 const booking={...valid,action:'create',service:'service',date:localDay.toISOString().slice(0,10),time:'09:00',requestId:crypto.randomUUID(),token:crypto.randomUUID().replaceAll('-','').repeat(2)};
 for(const [field,value] of [['name','中文'],['vehicle','トヨタ'],['notes','车辆故障'],['email','用户@example.com']]){const r=await request('/api/workshop',{...booking,[field]:value});check('Booking API rejects non-English '+field,r.response.status===400&&r.data.error==='ENGLISH_ONLY');}
 const available=await request('/api/workshop?action=availability&date='+booking.date);booking.time=available.data.times[0];assert.ok(booking.time,'Local future appointment available');
 const saved=await request('/api/workshop',booking);check('English booking creates successfully',saved.response.status===201);
 const cancelled=await request('/api/workshop',{action:'cancel',id:booking.requestId},{headers:{Authorization:'Bearer '+booking.token}});check('Test booking cancelled',cancelled.response.ok);
 // Check pagination against seeded LOCAL test rows. Never inserts production content.
 const page=await request('/api/comments');check('First comment page capped at 12',page.data.comments.length===12&&page.data.nextCursor);
 const older=await request('/api/comments?cursor='+encodeURIComponent(page.data.nextCursor));check('Pagination has no repeated IDs',older.response.ok&&older.data.comments.length>0&&!older.data.comments.some(c=>page.data.comments.some(first=>first.id===c.id)));
}
console.log(`${passed} checks passed. No paid AI requests.`);
