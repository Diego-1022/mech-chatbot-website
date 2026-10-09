import { z } from "zod";

const cleanText = (value: string) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value);
export const commentInput = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().max(40).refine(cleanText).default(""),
  message: z.string().trim().min(1).max(1000).refine(cleanText),
  website: z.string().max(0).optional(),
});
export const commentModeration = z.object({ id: z.string().uuid(), status: z.enum(["visible", "hidden"]) });
export type WorkshopComment = { id: string; name: string; message: string; created_at: string; status?: "visible" | "hidden" };
export function makeCommentCursor(row: WorkshopComment) {
  return btoa(`${row.created_at}|${row.id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function parseCommentCursor(value: string | null) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw new Error("INVALID_CURSOR");
  const [date, id, extra] = atob(value.replace(/-/g, "+").replace(/_/g, "/")).split("|");
  if (extra || !z.string().datetime().safeParse(date).success || !z.string().uuid().safeParse(id).success) throw new Error("INVALID_CURSOR");
  return { date, id };
}
