import { env } from "cloudflare:workers";
import { database } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { commentInput, commentModeration, makeCommentCursor, parseCommentCursor, type WorkshopComment } from "@/lib/comments-contract";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
async function isAdmin() {
  const user = await getChatGPTUser();
  const email = env.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  return !!user && !!email && user.email.toLowerCase() === email.trim().toLowerCase();
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const admin = url.searchParams.get("scope") === "admin";
    if (admin && !await isAdmin()) return json({ error: "ADMIN_REQUIRED" }, 403);
    let cursor;
    try { cursor = parseCommentCursor(url.searchParams.get("cursor")); } catch { return json({ error: "INVALID_INPUT" }, 400); }
    const size = admin ? 30 : 12;
    const conditions = [admin ? "1=1" : "status='visible'"];
    const values: (string | number)[] = [];
    if (cursor) { conditions.push("(created_at < ? OR (created_at = ? AND id < ?))"); values.push(cursor.date, cursor.date, cursor.id); }
    values.push(size + 1);
    const { results } = await database().prepare(`SELECT id,name,message,created_at${admin ? ",status" : ""} FROM comments WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...values).all<WorkshopComment>();
    const comments = results.slice(0, size);
    return json({ comments, nextCursor: results.length > size ? makeCommentCursor(comments[comments.length - 1]) : null });
  } catch { return json({ error: "UNAVAILABLE" }, 503); }
}
export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("origin") !== origin) return json({ error: "BAD_ORIGIN" }, 403);
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "INVALID_INPUT" }, 400);
    const raw = await request.text();
    if (raw.length > 7000) return json({ error: "INVALID_INPUT" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "INVALID_INPUT" }, 400); }
    if (body?.action === "moderate") {
      if (!await isAdmin()) return json({ error: "ADMIN_REQUIRED" }, 403);
      const parsed = commentModeration.safeParse(body);
      if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
      const result = await database().prepare("UPDATE comments SET status=? WHERE id=?").bind(parsed.data.status, parsed.data.id).run();
      return result.meta.changes ? json({ ok: true }) : json({ error: "NOT_FOUND" }, 404);
    }
    if (body?.action !== "create") return json({ error: "INVALID_INPUT" }, 400);
    const parsed = commentInput.safeParse(body);
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const data = parsed.data;
    const existing = await database().prepare("SELECT id,name,message,created_at,status FROM comments WHERE id=?").bind(data.requestId).first<WorkshopComment>();
    if (existing) {
      if (existing.name !== data.name || existing.message !== data.message || existing.status !== "visible") return json({ error: "INVALID_INPUT" }, 409);
      return json({ comment: { id: existing.id, name: existing.name, message: existing.message, created_at: existing.created_at } });
    }
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`comments:${ip}`)));
    const key = "comments:" + Array.from(digest, v => v.toString(16).padStart(2, "0")).join("");
    const window = Math.floor(Date.now() / 60000);
    const rate = await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind(key, window).first<{ hits: number }>();
    if ((rate?.hits || 0) > 3) return json({ error: "RATE_LIMIT" }, 429);
    const created_at = new Date().toISOString();
    // A concurrent retry can race the initial lookup; the unique ID keeps one row.
    await database().prepare("INSERT OR IGNORE INTO comments(id,name,message,status,created_at) VALUES(?,?,?,'visible',?)").bind(data.requestId, data.name, data.message, created_at).run();
    const saved = await database().prepare("SELECT id,name,message,created_at,status FROM comments WHERE id=?").bind(data.requestId).first<WorkshopComment>();
    if (!saved || saved.name !== data.name || saved.message !== data.message || saved.status !== "visible") return json({ error: "INVALID_INPUT" }, 409);
    return json({ comment: { id: saved.id, name: saved.name, message: saved.message, created_at: saved.created_at } }, 201);
  } catch { return json({ error: "UNAVAILABLE" }, 503); }
}
