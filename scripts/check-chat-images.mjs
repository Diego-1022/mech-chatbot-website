import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function moduleAt(path){const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {validateChatImages,jpegDimensions,readChatRequest,MAX_CHAT_BODY_BYTES,MAX_CHAT_IMAGE_BYTES}=await moduleAt('lib/chat-images.ts');
const {openaiReply,MODEL}=await moduleAt('lib/openai-assistant.ts');
let checks=0;
function check(name,ok){assert.ok(ok,name);checks++;console.log('PASS '+name)}
async function rejects(name,fn,code){let error;try{await fn()}catch(e){error=e}check(name,!!error&&(!code||error.code===code))}
// Minimal JPEG header is only a parser fixture; no synthetic bytes go to OpenAI.
const jpeg=(width=100,height=80)=>Uint8Array.from([255,216,255,192,0,11,8,height>>8,height&255,width>>8,width&255,1,1,0x11,0,255,217]);
const dataUrl=bytes=>'data:image/jpeg;base64,'+Buffer.from(bytes).toString('base64');
const images=[{dataUrl:dataUrl(jpeg())}];
check('JPEG dimensions',jpegDimensions(jpeg()).width===100);
check('Two images accepted',validateChatImages([...images,...images]).length===2);
check('No attachment remains text-only',validateChatImages(undefined).length===0);
await rejects('Third image rejected',()=>validateChatImages([...images,...images,...images]),'TOO_MANY_CHAT_IMAGES');
await rejects('URL input rejected (no arbitrary remote fetch)',()=>validateChatImages([{dataUrl:'https://example.com/photo.jpg'}]),'INVALID_CHAT_IMAGE');
await rejects('SVG rejected',()=>validateChatImages([{dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}]),'INVALID_CHAT_IMAGE');
await rejects('Fake JPEG rejected',()=>validateChatImages([{dataUrl:dataUrl(Buffer.from('<svg/>'))}]),'INVALID_CHAT_IMAGE');
await rejects('Bad base64 rejected',()=>validateChatImages([{dataUrl:'data:image/jpeg;base64,%%%'}]),'INVALID_CHAT_IMAGE');
await rejects('Over-dimension image rejected',()=>validateChatImages([{dataUrl:dataUrl(jpeg(1601))}]),'INVALID_CHAT_IMAGE');
await rejects('Zero-dimension image rejected',()=>validateChatImages([{dataUrl:dataUrl(jpeg(0))}]),'INVALID_CHAT_IMAGE');
await rejects('Oversized normalized image rejected',()=>validateChatImages([{dataUrl:dataUrl(new Uint8Array(MAX_CHAT_IMAGE_BYTES+1))}]),'INVALID_CHAT_IMAGE');
check('Maximum normalized dimension accepted',validateChatImages([{dataUrl:dataUrl(jpeg(1600,1600))}]).length===1);
check('Bounded body accepts complete request',(await readChatRequest(new Request('https://test.invalid',{method:'POST',body:'{"x":1}'}),20))==='{"x":1}');
await rejects('Declared body oversize rejected',()=>readChatRequest(new Request('https://test.invalid',{method:'POST',body:'x',headers:{'Content-Length':String(MAX_CHAT_BODY_BYTES+1)}}),MAX_CHAT_BODY_BYTES),'CHAT_REQUEST_TOO_LARGE');
await rejects('Chunked body oversize rejected',()=>readChatRequest(new Request('https://test.invalid',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(10));c.enqueue(new Uint8Array(11));c.close()}}),duplex:'half'}),20),'CHAT_REQUEST_TOO_LARGE');
let sent;
const mock=(data,status=200)=>async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]},{status})};
const answer={reply:'Possible tyre damage. An inspection is needed.',service:'tyres',book:false,imageAssessment:'relevant'};
let result=await openaiReply('test-not-a-key','Please inspect','en',[],mock(answer),images);
check('Existing model reused',sent.model===MODEL);
check('Provider storage disabled',sent.store===false);
check('Real image input in Responses payload',sent.input[0].content[1].type==='input_image'&&sent.input[0].content[1].image_url===images[0].dataUrl);
check('Image uses high detail',sent.input[0].content[1].detail==='high');
check('Tyre evidence maps to tyre catalogue price',result.estimate.min===80&&result.estimate.max===280);
result=await openaiReply('test-not-a-key','Please inspect','zh',[],mock({...answer,service:'brakes'}),images);
check('Different identified service changes estimate',result.estimate.min===80&&result.estimate.max===650);
check('Chinese instruction retained',sent.instructions.includes('Simplified Chinese'));
for(const imageAssessment of ['unclear','unrelated','urgent']){
 result=await openaiReply('test-not-a-key','Please inspect','en',[],mock({...answer,imageAssessment}),images);
 check(imageAssessment+' image cannot produce a price',result.estimate===null);
}
result=await openaiReply('test-not-a-key','Please inspect','en',[],mock({...answer,reply:'The repair is AUD 999.'}),images);
check('Model cannot inject its own price',!result.reply.includes('999'));
await rejects('Unknown assessment rejected',()=>openaiReply('test-not-a-key','photo','en',[],mock({...answer,imageAssessment:'certain'}),images),'AI_UNAVAILABLE');
await rejects('Invalid service rejected',()=>openaiReply('test-not-a-key','photo','en',[],mock({...answer,service:'invented'}),images),'AI_UNAVAILABLE');
await rejects('Provider rate limit classified',()=>openaiReply('test-not-a-key','photo','en',[],mock(answer,429),images),'AI_BUSY');
await rejects('Provider failure classified',()=>openaiReply('test-not-a-key','photo','en',[],async()=>{throw Error('timeout')},images),'AI_UNAVAILABLE');
result=await openaiReply('test-not-a-key','brake noise','en',[],mock({reply:'Arrange an inspection.',service:'brakes',book:false}));
check('Text-only contract retained',typeof sent.input[0].content==='string'&&!('imageAnalysis' in result)&&result.estimate.max===650);

if(process.argv[2]){
 const origin=new URL(process.argv[2]);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname),'Local integration only');
 let ip=20;
 async function post(body,extra={}){const r=await fetch(origin.origin+'/api/workshop',{method:'POST',headers:{Origin:origin.origin,'Content-Type':'application/json','X-Chat-Images':'1','CF-Connecting-IP':'192.0.2.'+(ip++),...extra},body:JSON.stringify(body)});return {r,b:await r.json()}}
 const body={action:'chat',message:'Service prices?',lang:'en',history:[],images,customerId:null};
 let p=await post(body,{Origin:'https://other.invalid'});check('Cross-origin images denied',p.r.status===403);
 p=await post({...body,images:[...images,...images,...images]});check('Server rejects third image',p.r.status===400);
 p=await post({...body,action:'create'});check('Large-body route cannot create booking',p.r.status===400);
 p=await post({...body,images:[{dataUrl:'https://other.invalid/x'}]});check('Server rejects remote URL',p.r.status===400);
 p=await post({...body,customerId:crypto.randomUUID()});check('Session switch blocks submission',p.r.status===409);
 p=await post(body);check('Offline image request bypasses FAQ and reports failure',p.r.ok&&p.b.imageAnalysis==='unavailable'&&p.b.estimate===null&&p.b.reply.includes('have not been analysed'));
 p=await post({...body,lang:'zh'});check('Chinese image fallback is explicit',p.r.ok&&p.b.reply.includes('没有分析'));
 p=await post({...body,images:[]});check('Text FAQ remains operational',p.r.ok&&p.b.mode==='guide');
 const signup=await fetch(origin.origin+'/api/account',{method:'POST',headers:{Origin:origin.origin,'Content-Type':'application/json'},body:JSON.stringify({action:'signup',name:'Image Test',email:`image-${crypto.randomUUID()}@example.invalid`,password:crypto.randomUUID()+crypto.randomUUID()})});
 const user=await signup.json(),cookie=signup.headers.get('set-cookie')?.split(';')[0];check('Local history fixture created',signup.ok&&cookie);
 p=await post({...body,customerId:user.user.id},{Cookie:cookie});check('Image analysis outcome saved for owner',p.r.ok&&p.b.historySaved);
 const account=await fetch(origin.origin+'/api/account',{headers:{Cookie:cookie}}).then(r=>r.json());
 check('History preserves attachment count',account.history[0].imageCount===1);
 check('History preserves analysis disclaimer marker',account.history[1].imageAnalysis==='unavailable');
 check('Image bytes excluded from D1 history',!JSON.stringify(account.history).includes('data:image'));
 const guest=await fetch(origin.origin+'/api/account').then(r=>r.json());check('Guest cannot access image conversation',guest.history.length===0);
}
console.log(`Passed ${checks} chat image checks. No real API calls made.`);
