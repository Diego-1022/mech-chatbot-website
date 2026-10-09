# Community, team and booking-field release — 10 October 2026

## Behaviour

- A public multilingual message board follows the contact footer. Optional nickname (40 characters), message (1–1000), newest first, 12 per page. No customer account is required. Messages are stored in D1 and escaped as plain React text. Per-IP posting limit: 3 per minute, using a hash in the existing rate-limit table. Hidden honeypot, origin checks, input limits and idempotent request IDs are enforced by the API.
- The authenticated administrator can list 30 messages per page and hide/restore them. Public responses exclude hidden rows and moderation status. Nothing is permanently deleted by this workflow.
- Booking names accept A–Z/a–z, spaces, apostrophes, periods and hyphens. Vehicle and notes accept printable ASCII, numbers, English punctuation and line breaks. Emails remain valid ASCII email addresses; telephone format retains digits and standard symbols. Client rejection explains the rule without silently transliterating input; server enforcement rejects bypass attempts. Public messages retain multilingual input.
- Our team presents Frank Bennett (56, 31 years), Daniel Park (38, 14 years), Alex Chen (22, apprentice in year 1), with 0/140/280 ms staggered slide-in cards. Image and identities are generated/fictional project content. Per owner instruction, customer-facing pages use professional workshop copy without classroom/fictional labels. Reduced-motion users see static cards; no-JS content remains visible.
- Contact details are owner-requested UNSW Kensington information: High St, Kensington NSW 2033, Australia; +61 2 9385 1000. Verified at https://www.unsw.edu.au/about-us/our-story/contact-us. Footer/map/phone and chatbot facts agree. No university affiliation is asserted.

## Database and release

Apply `drizzle/0001_lethal_spot.sql` to the existing D1 database before deploying the new Worker. It creates only `comments` and its paging index. Existing bookings, rate limits and secrets remain. Drizzle metadata is updated. Cloudflare OAuth requires D1 write access in addition to the established Worker scopes.

Run `node scripts/check-community.mjs` for pure input/cursor checks. Integration checks accept a local URL only, use isolated `.wrangler/community-test` and generated local credentials, and require local pagination fixtures. Never point them at production. Then run TypeScript, lint for changed/new code, and Cloudflare build. Deploy with `--keep-vars`; ensure build stripping removes all `.dev.vars` and `.env` files. Keep the PR branch and use a merge commit.

Validation performed: 43 local input/API checks covering persistence, duplicate/concurrent requests, Unicode comments, escaped HTML data, pagination, hidden/public visibility, authenticated moderation, origin/honeypot/length/rate rejection, English-booking creation and test cancellation. Browser checks cover real form rejection of Chinese/Japanese, English review, public comment post/refresh, 320/390/1280 widths, language switch, square navigation and team-card stagger. TypeScript/build pass. New-code lint has no errors; one normal raw-image warning. Existing modules retain inherited lint issues. Paid AI calls are not part of this validation. OS reduced-motion preference and other browser engines have not been exercised; the fallback is implemented and reviewed.
