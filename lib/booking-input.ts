import {z} from "zod";

/** Character and detail validation shared by the form and booking API. */
export const englishCharacters = /^[\x20-\x7e\r\n\t]*$/;
export const englishName = /^[A-Za-z][A-Za-z .'-]*$/;
export const phoneCharacters = /^[+\d ()-]{6,30}$/;
export const bookingTextKeys = ["name", "email", "phone", "vehicle", "notes"] as const;
export function hasNonEnglishBookingText(data: Record<string, unknown>) {
  return bookingTextKeys.some(key => typeof data[key] === "string" && !englishCharacters.test(data[key] as string));
}
export function validEnglishDetails(data: { name: string; email: string; phone: string; vehicle: string; notes: string }) {
  return !hasNonEnglishBookingText(data) && bookingDetailsSchema.safeParse(data).success;
}

// Accept formatted local/international numbers, not punctuation-only contacts.
// This checks syntax and digit count, not whether a number is assigned or reachable.
export function validBookingPhone(value: string) {
  const compact = value.replace(/[ ()-]/g, "");
  return phoneCharacters.test(value) && /^\+?[0-9]{8,15}$/.test(compact);
}

export const bookingDetailsSchema = z.object({
  name: z.string().trim().min(1, "BOOKING_NAME").max(80, "BOOKING_NAME").regex(englishName, "BOOKING_NAME"),
  email: z.string().trim().email("BOOKING_EMAIL").max(150, "BOOKING_EMAIL").regex(englishCharacters, "BOOKING_EMAIL"),
  phone: z.string().trim().refine(validBookingPhone, "BOOKING_PHONE"),
  vehicle: z.string().trim().min(2, "BOOKING_VEHICLE").max(120, "BOOKING_VEHICLE").regex(englishCharacters, "BOOKING_VEHICLE"),
  notes: z.string().trim().max(1000, "BOOKING_NOTES").regex(englishCharacters, "BOOKING_NOTES").default(""),
});

export type BookingField = typeof bookingTextKeys[number];
export type BookingFieldErrors = Partial<Record<BookingField, string>>;
export function bookingFieldErrors(error: z.ZodError): BookingFieldErrors {
  const errors: BookingFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as BookingField;
    if (bookingTextKeys.includes(key) && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
