import {validatePhotoFile,detectPhotoMime,mimeMatches,photoMime} from "./booking-photos";
import {MAX_CHAT_IMAGE_BYTES,MAX_CHAT_IMAGE_EDGE,type ChatImage} from "./chat-images";

export async function prepareChatImage(file:File):Promise<ChatImage>{
 validatePhotoFile(file);
 const detected=detectPhotoMime(new Uint8Array(await file.slice(0,128).arrayBuffer()));
 if(!detected||!mimeMatches(photoMime(file),detected))throw new Error("INVALID_CHAT_IMAGE");
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;
  try{await image.decode()}catch{throw new Error("CHAT_IMAGE_DECODE")}
  if(!image.naturalWidth||!image.naturalHeight)throw new Error("CHAT_IMAGE_DECODE");
  const scale=Math.min(1,MAX_CHAT_IMAGE_EDGE/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("CHAT_IMAGE_DECODE");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  // Re-encoding strips EXIF/location metadata and freezes animated formats.
  for(const quality of [.85,.7,.5,.35]){
   const dataUrl=canvas.toDataURL("image/jpeg",quality);
   if(dataUrl.startsWith("data:image/jpeg;base64,")&&(dataUrl.length-23)*3/4<=MAX_CHAT_IMAGE_BYTES)return {dataUrl};
  }
  throw new Error("CHAT_IMAGE_COMPRESS");
 }finally{URL.revokeObjectURL(url);image.src=""}
}
