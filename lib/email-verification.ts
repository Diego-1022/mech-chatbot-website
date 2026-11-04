import {env} from "cloudflare:workers";
import {randomBytes} from "node:crypto";
import {database} from "@/db";
import {AccountProblem,digest,type Customer} from "./customer-session";
import {budget,emailVerificationEnabled} from "./abuse-protection";

export async function sendVerification(user:Customer){
  if(!emailVerificationEnabled()||!env.EMAIL||!env.EMAIL_FROM||!env.PUBLIC_SITE_URL)throw new AccountProblem("EMAIL_UNAVAILABLE",503);
  if(user.emailVerifiedAt)return;
  if(!await budget(user.id,"email-minute",1,60000)||!await budget(user.id,"email-day",5))throw new AccountProblem("RATE_LIMIT",429);
  const token=randomBytes(32).toString("hex"),tokenHash=await digest(token),now=Date.now();
  const link=new URL("/account",env.PUBLIC_SITE_URL);if(link.protocol!=="https:")throw new AccountProblem("EMAIL_UNAVAILABLE",503);
  link.hash="verify="+token;
  await database().prepare("INSERT INTO email_verifications(customer_id,token_hash,expires_at) VALUES(?,?,?) ON CONFLICT(customer_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at").bind(user.id,tokenHash,now+30*60000).run();
  try{await env.EMAIL.send({from:env.EMAIL_FROM,to:user.email,subject:"Verify your Harbour Auto email",text:`Verify your email for Harbour Auto. Sign in to the same account, then open this link and select Verify email:\n\n${link.toString()}\n\nThis single-use link expires in 30 minutes. If you did not request this, ignore this email.`})}
  catch{await database().prepare("DELETE FROM email_verifications WHERE customer_id=? AND token_hash=?").bind(user.id,tokenHash).run();throw new AccountProblem("EMAIL_UNAVAILABLE",503)}
}
export async function confirmEmail(user:Customer,token:unknown){
  if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))throw new AccountProblem("EMAIL_LINK_INVALID");
  const tokenHash=await digest(token),now=Date.now();
  // D1 batch is transactional; the conditional update and token consumption are inseparable.
  const result=await database().batch([
    database().prepare("UPDATE customers SET email_verified_at=? WHERE id=? AND email_verified_at IS NULL AND EXISTS(SELECT 1 FROM email_verifications WHERE customer_id=? AND token_hash=? AND expires_at>?)").bind(new Date(now).toISOString(),user.id,user.id,tokenHash,now),
    database().prepare("DELETE FROM email_verifications WHERE customer_id=? AND token_hash=?").bind(user.id,tokenHash),
  ]);
  if(!result[0].meta.changes)throw new AccountProblem("EMAIL_LINK_INVALID");
}
