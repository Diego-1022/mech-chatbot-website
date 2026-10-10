# Multipage site and customer accounts

The homepage contains the scroll-driven wheel, booking form, folded public feedback and shared footer. Services, team, contact, account and terms/privacy have direct routes. Service cards link to `/?service=<catalogue-id>#booking`; homepage hydration selects the service and scrolls to the form. The default booking date skips Sunday.

The shared navigation uses native links through `components/page-link.tsx`. The current Vinext beta production build threw during `next/link` prefetch and click, so normal browser navigation is intentional. Mobile navigation opens a two-column menu with a fixed 42×42px button. Preserve keyboard/native-link behaviour and both languages.

Generated falling-parts media is no longer rendered on services; its original assets and attribution remain in the repository. The existing fixed-light wheel and team slide-in effects remain. Chat uses a matching dark palette; embedded booking retains its readable light surface.

Contact display: the owner requested an invented Chatswood address, `12 Harbour Lane, Chatswood NSW 2067`, and generic `02 9999 9999`. This is internal provenance, not a verified business location. Map links show the Chatswood area. `lib/workshop-info.ts` supplies all displayed contact details; daily hours retain Mon–Fri 09–17, Sat 09–12, Sun closed. FAQ and AI instructions use the same details.

## Customer access

Apply additive migration `0003_cultured_norman_osborn.sql` before deploying account-dependent code. It adds customers, hashed opaque sessions, private chat rows and nullable booking ownership; existing guest bookings stay unclaimed.

`/api/account`: GET returns current user, up to 100 owned bookings and latest 60 chat messages, or empty guest state. POST handles signup, login, logout and clearing the current user's history. Origin checks, bounded JSON bodies and 15-minute IP limits protect mutations. Customer and administrator sessions are independent.

Passwords are salted PBKDF2-HMAC-SHA256 with 600,000 iterations using native `node:crypto` (verified in the local Workers runtime). Sessions use random 256-bit tokens, SHA-256 hashes in D1, a seven-day expiry and an HttpOnly, SameSite=Lax cookie with Secure on HTTPS. Plaintext credentials never appear in responses, logs, source or release records.

New bookings use the server-verified session owner, never a supplied customer ID or email lookup. Token retries retain original ownership. `/manage?id=<id>` and private photo endpoints accept the owning customer session as well as the original private bearer token; unrelated sessions receive 404. Existing admin access remains independent. The original 2-photo/20MB-per-file limits remain.

Chat exchanges are recorded server-side after a generated/guide response, only for the current customer. The API reports whether persistence succeeded. A client-submitted expected customer ID prevents a stale window from saving a previous account's chat into a new session. History is capped at 60 messages and can be cleared by its owner. Guest chats remain temporary. Existing AI/guide/fallback labels and safety rules remain.

Email verification, self-service password recovery and a 3D wheel rebuild are deferred. Do not automatically claim past bookings by email without verified proof of ownership.

## Checks

`node scripts/check-accounts.mjs http://127.0.0.1:5174` runs local synthetic signup/login, origin/body/rate limits, session revocation, booking/photo/history isolation, legacy private access and direct-route checks. It rejects production targets and makes no paid AI requests. Existing community and booking-photo checks remain required for their affected paths. Temporary local fixtures and credentials must stay outside Git and be stripped from deployment output.

Cryptography sources: [Cloudflare node:crypto support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) and [OWASP password storage recommendations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
