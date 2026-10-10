import {scrypt,randomBytes,timingSafeEqual} from "node:crypto";

// OWASP's 16MiB profile; verified against the hosted Workers runtime.
// Hosted PBKDF2 rejects >100,000 rounds even though local workerd accepts them.
const OPTIONS={N:16384,r:8,p:5,maxmem:32*1024*1024};
export const DUMMY_PASSWORD_HASH="scrypt$16384$8$5$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
function derive(password:string,salt:string) {
  return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,OPTIONS,(error,key)=>error?reject(error):resolve(key)));
}
export async function passwordHash(password:string) {
  const salt=randomBytes(16).toString("hex");
  return `scrypt$16384$8$5$${salt}$${(await derive(password,salt)).toString("hex")}`;
}
export async function passwordMatches(password:string,stored:string) {
  const match=/^scrypt\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored);
  if(!match)return false;
  return timingSafeEqual(await derive(password,match[1]),Buffer.from(match[2],"hex"));
}
