/** English-character policy shared by the form and booking API. */
export const englishCharacters = /^[\x20-\x7e\r\n\t]*$/;
export const englishName = /^[A-Za-z][A-Za-z .'-]*$/;
export const phoneCharacters = /^[+\d ()-]{6,30}$/;
export const bookingTextKeys = ["name", "email", "phone", "vehicle", "notes"] as const;
export function hasNonEnglishBookingText(data: Record<string, unknown>) {
  return bookingTextKeys.some(key => typeof data[key] === "string" && !englishCharacters.test(data[key] as string));
}
export function validEnglishDetails(data: { name: string; email: string; phone: string; vehicle: string; notes: string }) {
  return !hasNonEnglishBookingText(data) && englishName.test(data.name.trim()) && phoneCharacters.test(data.phone.trim());
}
