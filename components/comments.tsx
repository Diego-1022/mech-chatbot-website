"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, RefreshCw } from "lucide-react";
import type { Lang } from "@/lib/catalog";
import type { WorkshopComment } from "@/lib/comments-contract";

async function commentRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string; comment: WorkshopComment };
  if (!response.ok) throw new Error(result.error || "UNAVAILABLE");
  return result;
}
function messageError(code: string, lang: Lang) {
  const messages: Record<string, [string, string]> = {
    RATE_LIMIT: ["留言过于频繁，请一分钟后再试。", "Please wait a minute before posting again."],
    INVALID_INPUT: ["请填写 1–1000 个字符的留言，昵称最多 40 个字符。", "Write a message of 1–1000 characters and a name of up to 40 characters."],
    ADMIN_REQUIRED: ["请重新登录管理员账号。", "Please sign in as the administrator again."],
  };
  return (messages[code] || ["暂时无法读取或保存留言，请重试。", "Messages are temporarily unavailable. Please try again."])[lang === "zh" ? 0 : 1];
}
async function getCommentPage(admin: boolean, cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams(admin ? { scope: "admin" } : {});
  if (cursor) query.set("cursor", cursor);
  const response = await fetch("/api/comments?" + query, { signal });
  const result = await response.json() as { error?: string; comments: WorkshopComment[]; nextCursor: string | null };
  if (!response.ok) throw new Error(result.error || "UNAVAILABLE");
  return result;
}
function useComments(admin: boolean) {
  const [comments, setComments] = useState<WorkshopComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (cursor: string | null = null, signal?: AbortSignal) => {
    try {
      const result = await getCommentPage(admin, cursor, signal);
      if (signal?.aborted) return;
      setComments(previous => cursor ? [...previous, ...result.comments.filter((row: WorkshopComment) => !previous.some(old => old.id === row.id))] : result.comments);
      setNextCursor(result.nextCursor);
    } catch (error) { if (!signal?.aborted) setError((error as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [admin]);
  useEffect(() => {
    const controller = new AbortController();
    getCommentPage(admin, null, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setComments(result.comments); setNextCursor(result.nextCursor);
    }).catch(error => { if (!controller.signal.aborted) setError((error as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin]);
  const reload = (cursor: string | null = null) => { setLoading(true); setError(""); return load(cursor); };
  return { comments, setComments, nextCursor, loading, error, setError, load: reload };
}
function CommentContent({ comment, lang }: { comment: WorkshopComment; lang: Lang }) {
  const name = comment.name || (lang === "zh" ? "访客" : "Guest");
  return <>
    <div className="comment-meta"><span className="comment-avatar" aria-hidden="true">{Array.from(name)[0].toUpperCase()}</span><strong>{name}</strong><time dateTime={comment.created_at}>{new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(new Date(comment.created_at))}</time></div>
    <p className="comment-message">{comment.message}</p>
  </>;
}
export default function Comments({ lang }: { lang: Lang }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const { comments, setComments, nextCursor, loading, error, load } = useComments(false);
  const [form, setForm] = useState({ name: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const [postError, setPostError] = useState("");
  const requestId = useRef<string | null>(null);
  const change = (key: keyof typeof form, value: string) => { requestId.current = null; setPosted(false); setPostError(""); setForm(previous => ({ ...previous, [key]: value })); };
  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setPostError(""); setPosted(false);
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await commentRequest({ action: "create", requestId: requestId.current, ...form });
      setComments(previous => [result.comment, ...previous.filter(row => row.id !== result.comment.id)]);
      requestId.current = null; setForm({ name: "", message: "", website: "" }); setPosted(true);
    } catch (error) { setPostError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="kw-comments" id="comments" aria-labelledby="comments-title">
    <div className="comments-inner">
      <div className="section-heading"><div><p className="eyebrow">{t("听听你的声音", "THE CONVERSATION")}</p><h2 id="comments-title">{t("留下你的想法。", "Leave a little feedback.")}</h2></div><p>{t("分享体验、建议，或打个招呼。", "Share an experience, a suggestion, or simply say hello.")}</p></div>
      <div className="comments-layout">
        <form className="comment-form" onSubmit={post}>
          <MessageSquare size={28} className="comment-form-icon" aria-hidden="true" />
          <h3>{t("写一条留言", "Join the conversation")}</h3>
          <label className="field" htmlFor="comment-name">{t("昵称（选填）", "Name (optional)")}<input id="comment-name" maxLength={40} autoComplete="nickname" placeholder={t("怎样称呼你？", "What should we call you?")} disabled={busy} value={form.name} onChange={event => change("name", event.target.value)} /></label>
          <label className="field" htmlFor="comment-message">{t("留言", "Message")}<textarea id="comment-message" required minLength={1} maxLength={1000} rows={5} disabled={busy} placeholder={t("写下你的想法…", "What's on your mind?")} value={form.message} onChange={event => change("message", event.target.value)} aria-describedby="comment-public-note" /></label>
          <div className="comment-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={event => change("website", event.target.value)} /></label></div>
          <p className="comment-counter">{form.message.length} / 1000</p>
          <p className="small muted" id="comment-public-note">{t("留言将公开展示，请勿填写电话、邮箱、预约链接等私人信息。", "Messages are public. Keep phone numbers, emails and private booking links out of your message.")}</p>
          <button className="primary full" disabled={busy || !form.message.trim()}><Send size={16} aria-hidden="true" />{busy ? t("正在发布…", "Posting…") : t("发布留言", "Post message")}</button>
          {postError && <p className="error" role="alert">{messageError(postError, lang)}</p>}
          {posted && <p className="comment-success" role="status">{t("留言已发布，谢谢你的分享。", "Your message is posted. Thanks for sharing.")}</p>}
        </form>
        <div className="comment-feed">
          <div className="comment-feed-heading"><h3>{t("最新留言", "Recent messages")}</h3><button type="button" className="comments-refresh" disabled={loading || busy} onClick={() => void load()} aria-label={t("刷新留言", "Refresh messages")}><RefreshCw size={17} /></button></div>
          {error && <p className="error" role="alert">{messageError(error, lang)}<button type="button" className="link" onClick={() => void load()}>{t("重试", "Retry")}</button></p>}
          {loading && <p className="comment-empty" role="status">{t("正在读取留言…", "Loading messages…")}</p>}
          {!loading && !error && !comments.length && <div className="comment-empty"><MessageSquare size={32} aria-hidden="true" /><p>{t("这里还没有留言。成为第一个发言的人吧。", "A fresh page. Be the first to leave a message.")}</p></div>}
          <div className="comment-list">{comments.map(comment => <article className="comment-entry" key={comment.id}><CommentContent comment={comment} lang={lang} /></article>)}</div>
          {nextCursor && <button type="button" className="secondary" disabled={loading} onClick={() => void load(nextCursor)}>{t("查看更早的留言", "Load earlier messages")}</button>}
        </div>
      </div>
    </div>
  </section>;
}
export function CommentsModeration({ lang }: { lang: Lang }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const { comments, setComments, nextCursor, loading, error, setError, load } = useComments(true);
  const [busy, setBusy] = useState<string | null>(null);
  async function moderate(comment: WorkshopComment) {
    if (busy) return;
    setBusy(comment.id); setError("");
    const status = comment.status === "visible" ? "hidden" : "visible";
    try { await commentRequest({ action: "moderate", id: comment.id, status }); setComments(previous => previous.map(row => row.id === comment.id ? { ...row, status } : row)); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(null); }
  }
  return <section className="panel comments-admin"><div className="toolbar"><h2>{t("留言管理", "Message moderation")}</h2><button className="secondary" disabled={loading || !!busy} onClick={() => void load()}>{t("刷新", "Refresh")}</button></div><p className="muted">{t("隐藏留言后，公众页面不再显示；可以随时恢复。", "Hidden messages leave the public feed and can be restored anytime.")}</p>{error && <p className="error" role="alert">{messageError(error, lang)}</p>}{loading && <p className="notice" role="status">{t("正在读取…", "Loading…")}</p>}{!loading && !error && !comments.length && <p className="notice">{t("暂时没有留言。", "No messages yet.")}</p>}{comments.map(comment => <article key={comment.id} className="comment-entry"><CommentContent comment={comment} lang={lang} /><div className="toolbar"><span className="status">{comment.status === "visible" ? t("公开", "Public") : t("已隐藏", "Hidden")}</span><button className="secondary" disabled={!!busy} onClick={() => void moderate(comment)}>{busy === comment.id ? t("正在保存…", "Saving…") : comment.status === "visible" ? t("隐藏留言", "Hide message") : t("恢复留言", "Restore message")}</button></div></article>)}{nextCursor && <button className="secondary" disabled={loading} onClick={() => void load(nextCursor)}>{t("更多留言", "More messages")}</button>}</section>;
}
