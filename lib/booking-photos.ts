export const MAX_BOOKING_PHOTOS = 2;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"];
export type BookingPhoto = { id: string; booking_id: string; slot: number; name: string; mime: string; size: number; created_at: string };
export class PhotoError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export function photoMime(file: Pick<File, "name" | "type">) {
  const declared = file.type.toLowerCase().replace("image/jpg", "image/jpeg");
  if (declared) return declared;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", heic: "image/heic", heif: "image/heif" } as Record<string, string>)[extension || ""] || "";
}
export function validatePhotoFile(file: Pick<File, "name" | "type" | "size">) {
  if (!file.size) throw new PhotoError("EMPTY_IMAGE");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("IMAGE_TOO_LARGE");
  if (!PHOTO_TYPES.includes(photoMime(file))) throw new PhotoError("INVALID_IMAGE_TYPE");
}
/** Identify the binary format, rather than trusting a renamed extension. */
export function detectPhotoMime(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0,6))) return "image/gif";
  if (bytes.length >= 16 && ascii(4,8) === "ftyp") {
    const brands = [ascii(8,12), ...Array.from({ length: Math.max(0, Math.floor(Math.min(bytes.length, 128) / 4) - 4) }, (_, i) => ascii(16+i*4,20+i*4))];
    if (brands.some(brand => ["avif", "avis"].includes(brand))) return "image/avif";
    if (brands.some(brand => ["heic", "heix", "hevc", "hevx"].includes(brand))) return "image/heic";
    if (brands.some(brand => ["mif1", "msf1"].includes(brand))) return "image/heif";
  }
  return null;
}
export function mimeMatches(declared: string, detected: string) {
  return declared === detected || (["image/heic", "image/heif"].includes(declared) && ["image/heic", "image/heif"].includes(detected));
}
export async function readPhotoBody(body: ReadableStream<Uint8Array> | null, expected: number) {
  if (!body) throw new PhotoError("EMPTY_IMAGE");
  if (!Number.isSafeInteger(expected) || expected < 1 || expected > MAX_PHOTO_BYTES) throw new PhotoError("INVALID_IMAGE_SIZE");
  // One bounded allocation avoids holding a full chunks list plus a second
  // concatenated copy for large mobile-camera files in the Worker isolate.
  const bytes = new Uint8Array(expected); const reader = body.getReader(); let total = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; const offset = total; total += part.value.byteLength; if (total > MAX_PHOTO_BYTES) { await reader.cancel(); throw new PhotoError("IMAGE_TOO_LARGE"); } if (total > expected) { await reader.cancel(); throw new PhotoError("INVALID_IMAGE_SIZE"); } bytes.set(part.value, offset); }
  } finally { reader.releaseLock(); }
  if (!total) throw new PhotoError("EMPTY_IMAGE");
  if (total !== expected) throw new PhotoError("INVALID_IMAGE_SIZE");
  return bytes;
}
export function photoErrorText(code: string, lang: "zh" | "en") {
  const messages: Record<string, [string, string]> = {
    TOO_MANY_IMAGES: ["每次预约最多添加 2 张图片。", "Add no more than 2 images per booking."],
    IMAGE_TOO_LARGE: ["每张图片不能超过 20 MB。", "Each image must be 20 MB or smaller."],
    EMPTY_IMAGE: ["不能上传空文件。", "Choose an image that is not empty."],
    INVALID_IMAGE_TYPE: ["请上传 JPG、PNG、WebP、GIF、AVIF 或 HEIC/HEIF 图片。", "Choose JPG, PNG, WebP, GIF, AVIF or HEIC/HEIF images."],
    INVALID_IMAGE_SIZE: ["图片未完整上传，请重试。", "The image transfer was incomplete. Please retry."],
    IMAGE_BUSY: ["这张图片正在上传，请稍后重试。", "This image is already uploading. Please retry shortly."],
    IMAGE_NOT_READY: ["图片正在同步，请稍后重试查看。", "The image is syncing. Please retry viewing shortly."],
    UPLOADS_UNAVAILABLE: ["图片存储暂时不可用。预约已保存，可稍后重试上传。", "Image storage is temporarily unavailable. Your booking is saved; retry the images shortly."],
    RATE_LIMIT: ["上传过于频繁，请稍后重试。", "Too many upload attempts. Please retry shortly."],
    NOT_ACTIVE: ["预约已取消或完成，无法再添加图片。", "This booking is no longer active; images cannot be added."],
  };
  return (messages[code] || ["图片上传未成功，预约资料已保留，请重试。", "The image upload did not finish. Your booking is retained; please retry."])[lang === "zh" ? 0 : 1];
}
