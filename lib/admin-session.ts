const encoder = new TextEncoder();
export const SESSION_COOKIE = "harbour_admin";
export const SESSION_SECONDS = 8 * 60 * 60;

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function decode(value:string) {
  if(!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
}
async function signingKey(secret:string) {
  if(secret.length<32) throw new Error("Admin session is not configured");
  return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function passwordMatches(input:string,expected:string) {
  if(expected.length<20 || input.length>256) return false;
  const [a,b]=await Promise.all([input,expected].map(v=>crypto.subtle.digest("SHA-256",encoder.encode(v))));
  const x=new Uint8Array(a),y=new Uint8Array(b);let difference=0;
  for(let i=0;i<x.length;i++) difference|=x[i]^y[i];
  return difference===0;
}
export async function createSession(secret:string,now=Date.now()) {
  const payload=base64url(encoder.encode(JSON.stringify({exp:Math.floor(now/1000)+SESSION_SECONDS,nonce:crypto.randomUUID()})));
  const signature=await crypto.subtle.sign("HMAC",await signingKey(secret),encoder.encode(payload));
  return payload+"."+base64url(new Uint8Array(signature));
}
export async function verifySession(token:string,secret:string,now=Date.now()) {
  try {
    if(!token || token.length>1024) return false;
    const pieces=token.split(".");if(pieces.length!==2)return false;
    const [payload,signature]=pieces;
    if(!await crypto.subtle.verify("HMAC",await signingKey(secret),decode(signature),encoder.encode(payload)))return false;
    const data=JSON.parse(new TextDecoder().decode(decode(payload)));
    const seconds=Math.floor(now/1000);
    return Number.isSafeInteger(data.exp)&&data.exp>seconds&&data.exp<=seconds+SESSION_SECONDS&&typeof data.nonce==="string";
  } catch {return false;}
}
export function tokenFromCookie(cookie:string) {
  return cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+"="))?.slice(SESSION_COOKIE.length+1)||"";
}
export function sessionCookie(token:string,secure:boolean,maxAge=SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?"; Secure":""}`;
}
