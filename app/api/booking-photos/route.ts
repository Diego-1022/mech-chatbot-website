import { env } from "cloudflare:workers";
import { z } from "zod";
import { database } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, detectPhotoMime, mimeMatches, readPhotoBody, PhotoError, type BookingPhoto } from "@/lib/booking-photos";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });
const uuid = z.string().uuid();
const token = z.string().regex(/^[a-f0-9]{64}$/);
type StoredPhoto = BookingPhoto & { storage_key: string; status: string; upload_nonce: string; updated_at: string };
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), n => n.toString(16).padStart(2, "0")).join(""); }
async function customer(request: Request, id: string) {
  const credential = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!token.safeParse(credential).success) return null;
  return database().prepare("SELECT id,status FROM bookings WHERE id=? AND token_hash=? AND status!='blocked'").bind(id, await digest(credential)).first<{ id: string; status: string }>();
}
async function authorisedReader(request: Request, id: string) {
  if (await customer(request, id)) return true;
  const user = await getChatGPTUser(); const email = env.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  if (!user || !email || user.email.toLowerCase() !== email.trim().toLowerCase()) return false;
  return !!await database().prepare("SELECT id FROM bookings WHERE id=? AND status!='blocked'").bind(id).first();
}
function publicPhoto(row: StoredPhoto): BookingPhoto { return { id: row.id, booking_id: row.booking_id, slot: row.slot, name: row.name, mime: row.mime, size: row.size, created_at: row.created_at }; }
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const id = url.searchParams.get("booking") || "";
    if (!uuid.safeParse(id).success || !await authorisedReader(request, id)) return json({ error: "NOT_FOUND" }, 404);
    const image = url.searchParams.get("image");
    if (!image) {
      const { results } = await database().prepare("SELECT * FROM booking_photos WHERE booking_id=? AND status='ready' ORDER BY slot").bind(id).all<StoredPhoto>();
      return json({ photos: results.map(publicPhoto) });
    }
    if (!uuid.safeParse(image).success) return json({ error: "NOT_FOUND" }, 404);
    const row = await database().prepare("SELECT * FROM booking_photos WHERE id=? AND booking_id=? AND status='ready'").bind(image, id).first<StoredPhoto>();
    if (!row) return json({ error: "NOT_FOUND" }, 404);
    if (!env.BOOKING_PHOTOS) return json({ error: "UPLOADS_UNAVAILABLE" }, 503);
    const body = await env.BOOKING_PHOTOS.get(row.storage_key, "stream");
    // KV may take time to propagate to another edge. Keep the metadata and
    // allow retry rather than treating delayed visibility as lost content.
    if (!body) return json({ error: "IMAGE_NOT_READY" }, 503);
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/heic": "heic", "image/heif": "heif" } as Record<string, string>)[row.mime];
    return new Response(body, { headers: { ...privateHeaders, "Content-Type": row.mime, "Content-Length": String(row.size), "Content-Disposition": `inline; filename="${row.id}.${extension}"` } });
  } catch { return json({ error: "UNAVAILABLE" }, 503); }
}
export async function POST(request: Request) {
  let locked: { id: string; nonce: string; key: string } | null = null;
  try {
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "BAD_ORIGIN" }, 403);
    const booking = url.searchParams.get("booking") || ""; const id = url.searchParams.get("image") || "";
    const slot = Number(url.searchParams.get("slot"));
    if (!uuid.safeParse(booking).success || !uuid.safeParse(id).success || ![0, 1].includes(slot) || !url.searchParams.has("slot")) return json({ error: "TOO_MANY_IMAGES" }, 400);
    const owner = await customer(request, booking);
    if (!owner) return json({ error: "NOT_FOUND" }, 404);
    if (owner.status !== "confirmed") return json({ error: "NOT_ACTIVE" }, 409);
    const size = Number(request.headers.get("x-file-size"));
    if (!Number.isSafeInteger(size) || size < 1) return json({ error: "EMPTY_IMAGE" }, 400);
    if (size > MAX_PHOTO_BYTES || Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES) return json({ error: "IMAGE_TOO_LARGE" }, 413);
    if (request.headers.has("content-length") && Number(request.headers.get("content-length")) !== size) return json({ error: "INVALID_IMAGE_SIZE" }, 400);
    const mime = request.headers.get("content-type")?.toLowerCase().split(";")[0].replace("image/jpg", "image/jpeg") || "";
    if (!PHOTO_TYPES.includes(mime)) return json({ error: "INVALID_IMAGE_TYPE" }, 400);
    let name = ""; try { name = decodeURIComponent(request.headers.get("x-file-name") || "").trim(); } catch { return json({ error: "INVALID_INPUT" }, 400); }
    if (!name || name.length > 160 || /[\x00-\x1f\x7f]/.test(name)) return json({ error: "INVALID_INPUT" }, 400);
    if (!env.BOOKING_PHOTOS) return json({ error: "UPLOADS_UNAVAILABLE" }, 503);
    const existing = await database().prepare("SELECT * FROM booking_photos WHERE id=?").bind(id).first<StoredPhoto>();
    if (existing && (existing.booking_id !== booking || existing.slot !== slot || existing.name !== name || existing.size !== size || existing.mime !== mime)) return json({ error: "INVALID_INPUT" }, 409);
    if (existing?.status === "ready") return json({ photo: publicPhoto(existing) });
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const rate = await database().prepare("INSERT INTO rate_limits(key,window,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits").bind("photo:" + await digest(ip), Math.floor(Date.now() / 60000)).first<{ hits: number }>();
    if ((rate?.hits || 0) > 8) return json({ error: "RATE_LIMIT" }, 429);
    const nonce = crypto.randomUUID(); const key = `booking-photos/${booking}/${id}/${nonce}`; const now = new Date().toISOString();
    if (existing) {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const lease = await database().prepare("UPDATE booking_photos SET upload_nonce=?,storage_key=?,updated_at=? WHERE id=? AND status='uploading' AND updated_at<?").bind(nonce, key, now, id, cutoff).run();
      if (!lease.meta.changes) return json({ error: "IMAGE_BUSY" }, 409);
      await env.BOOKING_PHOTOS.delete(existing.storage_key).catch(() => {});
    } else {
      await database().prepare("INSERT OR IGNORE INTO booking_photos(id,booking_id,slot,name,mime,size,storage_key,status,upload_nonce,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'uploading',?,?,?)").bind(id, booking, slot, name, mime, size, key, nonce, now, now).run();
      const claim = await database().prepare("SELECT upload_nonce FROM booking_photos WHERE id=? AND booking_id=?").bind(id, booking).first<{ upload_nonce: string }>();
      if (claim?.upload_nonce !== nonce) return json({ error: claim ? "IMAGE_BUSY" : "TOO_MANY_IMAGES" }, 409);
    }
    locked = { id, nonce, key };
    const bytes = await readPhotoBody(request.body, size);
    const detected = detectPhotoMime(bytes.subarray(0, 128));
    if (!detected || !mimeMatches(mime, detected)) throw new PhotoError("INVALID_IMAGE_TYPE");
    await env.BOOKING_PHOTOS.put(key, bytes, { metadata: { mime, size } });
    const saved = await database().prepare("UPDATE booking_photos SET status='ready',updated_at=? WHERE id=? AND upload_nonce=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='confirmed')").bind(new Date().toISOString(), id, nonce, booking).run();
    if (!saved.meta.changes) throw new PhotoError("NOT_ACTIVE");
    locked = null;
    return json({ photo: { id, booking_id: booking, slot, name, mime, size, created_at: existing?.created_at || now } }, 201);
  } catch (error) {
    if (locked) {
      await env.BOOKING_PHOTOS?.delete(locked.key).catch(() => {});
      await database().prepare("DELETE FROM booking_photos WHERE id=? AND upload_nonce=? AND status='uploading'").bind(locked.id, locked.nonce).run().catch(() => {});
    }
    if (error instanceof PhotoError) return json({ error: error.code }, error.code === "IMAGE_TOO_LARGE" ? 413 : 400);
    return json({ error: "UPLOADS_UNAVAILABLE" }, 503);
  }
}
