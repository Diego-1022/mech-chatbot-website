# Booking validation and step visibility

Fixes from the owner's 2026-10-28 booking inspection report:

- `lib/booking-input.ts` owns one Zod detail schema for browser review/final submission and API creation. Normalized names, email, phone, vehicle and notes follow the same limits on both sides. Existing English-character rules remain.
- Phone syntax now requires8–15 digits after removing spaces, parentheses and hyphens. An optional plus is allowed only at the start; formatted local and international numbers are supported. This does not verify assignment or reachability.
- Vehicle details require2–120 characters after trimming; email uses the existing server Zod `.email()` rule. `a@b`, symbols-only phones and whitespace-only vehicles are rejected before review and by the API.
- The details form uses shared validation with bilingual, field-linked errors and focus on the first invalid field. Browser-native validation is disabled for this form to avoid different acceptance rules.
- Step changes focus the step heading and reveal it below the fixed site header. Inside chat, only the message scroller moves. The first page render does not force focus/scroll. Details remain when navigating back and forth; final submission validates again.

## Verification

`node scripts/check-booking-validation.mjs` runs46 detail checks. An optional localhost URL adds12 isolated API checks: rejection without persistence, valid trimmed save, idempotent retry, private lookup and cancellation. Never run this integration command against production.

Completed for this release:58 booking validation/API checks,17 community/character-policy checks, TypeScript, production build and diff whitespace check. New/changed validation helper and test lint clean; legacy booking/API/client lint errors unchanged.

Local browser: report's three bad inputs produce individual errors and stay at details; valid data reaches review. Repeated edit/review and return-to-time with a different time preserve details. Heading is focused and visible below the header at1280×720,390×844 English and320×740 Chinese; no horizontal overflow. Embedded chat review is visible and leaves the page scroll position unchanged.

Production verification is read-only through review; no live test booking, image upload, paid AI call, schema migration or database export is required. Physical mobile keyboard/camera, a full browser matrix, production final save and slot concurrency are outside this change's live checks.
