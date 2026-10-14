import {detectPhotoMime,MAX_BOOKING_PHOTOS} from "./booking-photos";

// Originals follow booking's 20 MB rule. Only bounded, re-encoded JPEGs cross
// the chat API; neither originals nor data URLs are stored in account history.
export const MAX_CHAT_IMAGE_BYTES=1024*1024;
export const MAX_CHAT_IMAGE_EDGE=1600;
export const MAX_CHAT_BODY_BYTES=2*Math.ceil(MAX_CHAT_IMAGE_BYTES/3)*4+24000;
export type ChatImage={dataUrl:string};
export class ChatImageError extends Error {constructor(public code:string,public status=400){super(code)}}
export function jpegDimensions(bytes:Uint8Array):{width:number;height:number}|null {
 if(detectPhotoMime(bytes)!=="image/jpeg")return null;
 let offset=2;
 while(offset+3<bytes.length){
  if(bytes[offset++]!==255)return null;
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===0xda||marker===0xd9)return null;
  if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;
  const length=(bytes[offset]<<8)|bytes[offset+1];
  if(length<2||offset+length>bytes.length)return null;
  if([0xc0,0xc1,0xc2].includes(marker)&&length>=8)return {height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};
  offset+=length;
 }
 return null;
}
export function validateChatImages(value:unknown):ChatImage[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>MAX_BOOKING_PHOTOS)throw new ChatImageError("TOO_MANY_CHAT_IMAGES");
 return value.map(image=>{
  if(!image||typeof image.dataUrl!=="string"||image.dataUrl.length>Math.ceil(MAX_CHAT_IMAGE_BYTES/3)*4+23)throw new ChatImageError("INVALID_CHAT_IMAGE");
  const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if(!match||match[1].length%4!==0)throw new ChatImageError("INVALID_CHAT_IMAGE");
  let binary:string;try{binary=atob(match[1])}catch{throw new ChatImageError("INVALID_CHAT_IMAGE")}
  if(binary.length>MAX_CHAT_IMAGE_BYTES)throw new ChatImageError("INVALID_CHAT_IMAGE");
  const dimensions=jpegDimensions(Uint8Array.from(binary,c=>c.charCodeAt(0)));
  if(!dimensions||dimensions.width<1||dimensions.height<1||Math.max(dimensions.width,dimensions.height)>MAX_CHAT_IMAGE_EDGE)throw new ChatImageError("INVALID_CHAT_IMAGE");
  return {dataUrl:image.dataUrl};
 });
}
export async function readChatRequest(request:Request,max:number){
 if(Number(request.headers.get("content-length"))>max)throw new ChatImageError("CHAT_REQUEST_TOO_LARGE",413);
 if(!request.body)throw new ChatImageError("INVALID_INPUT");
 const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text="";
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ChatImageError("CHAT_REQUEST_TOO_LARGE",413)}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock()}
}
export const imageDisclaimer={
 en:"AI photo analysis can be wrong and cannot detect hidden damage or confirm that a vehicle is safe to drive. Estimates are indicative catalogue ranges, not a diagnosis or final quote. A qualified mechanic must inspect the vehicle before confirming repairs and pricing.",
 zh:"AI 图片分析可能出错，无法发现隐藏损伤，也不能确认车辆是否适合继续驾驶。费用为目录参考区间，不构成故障诊断或最终报价；维修方案和价格须由合格维修师傅现场检查后确认。"
};
