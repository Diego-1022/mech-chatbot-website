import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAX_PHOTO_BYTES,MAX_BOOKING_PHOTOS,validatePhotoFile,photoMime,detectPhotoMime,mimeMatches,readPhotoBody} from '../lib/booking-photos.ts';
let checks=0;
function check(name,ok){assert.ok(ok,name);checks++;console.log('PASS '+name);}
function rejectCode(fn,code){try{fn();return false;}catch(error){return error.code===code;}}
const meta={name:'warning-light.jpg',type:'image/jpeg',size:MAX_PHOTO_BYTES};
check('Two-photo limit is configured',MAX_BOOKING_PHOTOS===2);
check('Exactly 20 MB accepted by client rule',(()=>{validatePhotoFile(meta);return true;})());
check('20 MB plus one byte rejected',rejectCode(()=>validatePhotoFile({...meta,size:MAX_PHOTO_BYTES+1}),'IMAGE_TOO_LARGE'));
check('Empty image rejected',rejectCode(()=>validatePhotoFile({...meta,size:0}),'EMPTY_IMAGE'));
check('SVG rejected',rejectCode(()=>validatePhotoFile({...meta,type:'image/svg+xml'}),'INVALID_IMAGE_TYPE'));
check('Missing HEIC MIME recovered from extension',photoMime({name:'IMG_001.HEIC',type:''})==='image/heic');
check('Image/jpg alias accepted',photoMime({name:'a.jpg',type:'image/jpg'})==='image/jpeg');
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
check('PNG binary signature recognised',detectPhotoMime(bytes)==='image/png');
check('JPEG signature recognised',detectPhotoMime(Uint8Array.from([255,216,255,224]))==='image/jpeg');
check('WebP signature recognised',detectPhotoMime(new TextEncoder().encode('RIFF1234WEBP'))==='image/webp');
check('GIF signature recognised',detectPhotoMime(new TextEncoder().encode('GIF89a'))==='image/gif');
check('HEIC signature recognised',detectPhotoMime(new TextEncoder().encode('0000ftypheic0000'))==='image/heic');
check('AVIF signature recognised',detectPhotoMime(new TextEncoder().encode('0000ftypavif0000'))==='image/avif');
check('Renamed SVG signature rejected',detectPhotoMime(new TextEncoder().encode('<svg><script>bad</script></svg>'))===null);
check('Declared JPEG with PNG body rejected',!mimeMatches('image/jpeg','image/png'));
check('HEIF/HEIC aliases are compatible',mimeMatches('image/heif','image/heic'));
const stream=(parts)=>new ReadableStream({start(controller){for(const part of parts)controller.enqueue(part);controller.close();}});
check('Chunked body assembled completely',(await readPhotoBody(stream([bytes.subarray(0,5),bytes.subarray(5)]),bytes.length)).length===bytes.length);
let failed=false;try{await readPhotoBody(stream([bytes]),bytes.length+1);}catch(error){failed=error.code==='INVALID_IMAGE_SIZE';}check('Truncated transfer rejected',failed);
failed=false;try{await readPhotoBody(stream([new Uint8Array(MAX_PHOTO_BYTES),new Uint8Array(1)]),MAX_PHOTO_BYTES);}catch(error){failed=error.code==='IMAGE_TOO_LARGE';}check('Oversized streamed body rejected',failed);

if(process.argv[2]){
 const origin=new URL(process.argv[2]);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'Integration tests are local-only');
 const fixtureDir=process.argv[3];assert.ok(fixtureDir,'Supply the local synthetic fixture directory');
 const credentials=Object.fromEntries(fs.readFileSync('dist/server/.dev.vars','utf8').trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),JSON.parse(line.slice(i+1))];}));
 const small=fs.readFileSync(fixtureDir+'/small.png'),large=fs.readFileSync(fixtureDir+'/exact-20mb.png');
 async function jsonRequest(path,body,headers={}){const response=await fetch(origin.origin+path,{method:body?'POST':'GET',headers:{...(body?{Origin:origin.origin,'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return{response,data:await response.json()};}
 const day=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+8);if(day.getUTCDay()===0)day.setUTCDate(day.getUTCDate()+1);
 const date=day.toISOString().slice(0,10);
 const times=(await jsonRequest('/api/workshop?action=availability&date='+date)).data.times;assert.ok(times.length>=3,'Three local times available');
 const bookings=[];
 for(let i=0;i<3;i++){const booking={action:'create',requestId:crypto.randomUUID(),token:crypto.randomUUID().replaceAll('-','').repeat(2),name:'Upload check',email:'upload@example.invalid',phone:'0400000000',vehicle:'Toyota Corolla 2020',notes:'Local image tests',service:'service',date,time:times[i]};const r=await jsonRequest('/api/workshop',booking);check('Local booking '+i+' saved',r.response.status===201);bookings.push(booking);}
 const b=bookings[0],c=bookings[1],d=bookings[2];
 const first=crypto.randomUUID(),second=crypto.randomUUID();
 const imagePath=(book,id,slot)=>`/api/booking-photos?booking=${book.requestId}&image=${id}&slot=${slot}`;
 async function upload(book,id,slot,content,opts={}){const response=await fetch(origin.origin+imagePath(book,id,slot),{method:'POST',headers:{Origin:origin.origin,'Content-Type':opts.mime||'image/png','X-File-Name':encodeURIComponent(opts.name||'image.png'),'X-File-Size':String(opts.size??content.length),Authorization:'Bearer '+(opts.token||book.token),...opts.headers},body:content,duplex:'half'});return{response,data:await response.json()};}
 let r=await upload(b,first,0,small,{token:'f'.repeat(64)});check('Another credential cannot upload',r.response.status===404);
 r=await upload(b,first,0,small,{headers:{Origin:'https://other.example'}});check('Cross-origin upload rejected',r.response.status===403);
 r=await upload(b,first,0,small,{size:MAX_PHOTO_BYTES+1});check('Server rejects declared oversize',r.response.status===413);
 r=await upload(b,first,0,new Uint8Array(0));check('Server rejects empty image',r.response.status===400);
 r=await upload(b,first,0,small,{mime:'image/svg+xml'});check('Server rejects SVG type',r.response.status===400);
 r=await upload(b,first,0,new TextEncoder().encode('<svg>not a PNG</svg>'));check('Server rejects renamed active content',r.response.status===400&&r.data.error==='INVALID_IMAGE_TYPE');
 r=await upload(b,first,0,small,{size:small.length+1});check('Server rejects transfer size mismatch',r.response.status===400);
 r=await upload(b,first,0,small,{name:'故障灯.png'});check('Valid image with Unicode filename saves',r.response.status===201&&r.data.photo.name==='故障灯.png');
 const again=await upload(b,first,0,small,{name:'故障灯.png'});check('Successful retry keeps one image',again.response.status===200&&again.data.photo.id===first);
 r=await upload(b,second,1,large);check('Full 20 MB image saves to local KV',r.response.status===201&&r.data.photo.size===MAX_PHOTO_BYTES);
 r=await upload(b,crypto.randomUUID(),2,small);check('Third position rejected',r.response.status===400&&r.data.error==='TOO_MANY_IMAGES');
 r=await upload(b,crypto.randomUUID(),0,small);check('Occupied position cannot create a third image',r.response.status===409);
 const ownerHeaders={Authorization:'Bearer '+b.token};
 r=await jsonRequest('/api/booking-photos?booking='+b.requestId,null,ownerHeaders);check('Owner lists two ready images',r.data.photos.length===2);check('Metadata does not expose storage keys or leases',r.data.photos.every(photo=>!('storage_key'in photo)&&!('upload_nonce'in photo)));
 r=await jsonRequest('/api/booking-photos?booking='+b.requestId);check('Anonymous image list denied',r.response.status===404);
 r=await jsonRequest('/api/booking-photos?booking='+b.requestId,null,{Authorization:'Bearer '+c.token});check('Other customer cannot list images',r.response.status===404);
 let image=await fetch(origin.origin+imagePath(b,first,0),{headers:ownerHeaders});check('Owner can read original bytes',image.ok&&Buffer.from(await image.arrayBuffer()).equals(small));check('Image response is private and MIME protected',image.headers.get('cache-control').includes('no-store')&&image.headers.get('x-content-type-options')==='nosniff'&&image.headers.get('content-type')==='image/png');
 image=await fetch(origin.origin+imagePath(b,second,1),{headers:ownerHeaders});check('Full 20 MB readback has correct byte length',image.ok&&(await image.arrayBuffer()).byteLength===MAX_PHOTO_BYTES);
 image=await fetch(origin.origin+imagePath(b,first,0));check('Anonymous original bytes denied',image.status===404);
 const auth=await jsonRequest('/api/admin-session',{password:credentials.ADMIN_PASSWORD});check('Local admin signs in',auth.response.ok);const cookie=auth.response.headers.get('set-cookie').split(';')[0];
 image=await fetch(origin.origin+imagePath(b,first,0),{headers:{Cookie:cookie}});check('Signed-in admin can read original',image.ok);
 const admin=await jsonRequest('/api/workshop?action=admin&date='+date,null,{Cookie:cookie});check('Admin booking response includes image descriptors',admin.data.bookings.find(row=>row.id===b.requestId).photos.length===2);
 const own=await jsonRequest('/api/workshop?action=booking&id='+b.requestId,null,ownerHeaders);check('Private booking response includes images',own.data.booking.photos.length===2);
 const concurrentId=crypto.randomUUID();const both=await Promise.all([upload(c,concurrentId,0,small),upload(c,concurrentId,0,small)]);check('Concurrent retry has a successful save',both.some(x=>x.response.ok));
 const concurrentList=await jsonRequest('/api/booking-photos?booking='+c.requestId,null,{Authorization:'Bearer '+c.token});check('Concurrent retry creates one descriptor',concurrentList.data.photos.length===1);
 // No Content-Length: verify the actual streamed byte limit, not only headers.
 const oversizedStream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_PHOTO_BYTES));controller.enqueue(new Uint8Array(1));controller.close();}});
 r=await upload(d,crypto.randomUUID(),0,oversizedStream,{size:MAX_PHOTO_BYTES});check('Raw oversized stream rejected by server',r.response.status===413);
 const emptyAfter=await jsonRequest('/api/booking-photos?booking='+d.requestId,null,{Authorization:'Bearer '+d.token});check('Rejected upload leaves no ready descriptor',emptyAfter.data.photos.length===0);
 for(const book of bookings){const cancelled=await jsonRequest('/api/workshop',{action:'cancel',id:book.requestId},{Authorization:'Bearer '+book.token});check('Local test booking cancelled',cancelled.response.ok);}
 r=await upload(b,crypto.randomUUID(),0,small);check('Cancelled booking cannot receive new photos',r.response.status===409&&r.data.error==='NOT_ACTIVE');
 image=await fetch(origin.origin+imagePath(b,first,0),{headers:ownerHeaders});check('Existing private photos remain readable after cancellation',image.ok);
}
console.log(`${checks} checks passed. Integration is local-only; no paid AI calls.`);
