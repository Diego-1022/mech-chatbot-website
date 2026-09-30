# Harbour Auto

A classroom workshop website. English is the default, with Chinese available from the header.

## Included
- Six fictional workshop services with clearly labelled AUD estimate ranges.
- Appointment slots in Australia/Sydney time, Monday–Friday 09:00–17:00 and Saturday 09:00–12:00.
- Booking, review, persistent save, private management links, rescheduling and cancellation.
- Database-enforced single active appointment per slot and retry-safe creation.
- Workshop administration restricted to the configured administrator's signed-in email.
- Closing/reopening individual future slots and marking bookings completed or cancelled.
- An OpenAI assistant (GPT-4.1 mini) with bounded conversation context, catalogue estimate cards and an embedded booking form. Explicitly labelled rule guidance remains available if the API is unavailable.

## What is not connected yet
The assistant uses OpenAI Responses with store:false; user chat text is sent to OpenAI, while booking contact details are not automatically included. The app does not store chat history in its database. There is no email/SMS delivery, payment processing, real business address or real phone number. All prices are fictional teaching data, not market quotes. Save the private management link after booking; the short reference alone does not grant access.

## Hosting and data
This version uses Cloudflare Workers and D1 through Sites, rather than the previously discussed Supabase option. The deployed Site is public. Its administrator dashboard still requires the configured administrator identity. The application has its own server-side administrator allowlist even if Site access is expanded later.

Appointment records are stored in D1, not browser storage. Management tokens are random and only their SHA-256 hashes are stored in the database. The raw token is held in the client's URL fragment. Use fictional contact details for demonstrations.

## Main source files
- app/garage.tsx: homepage and service cards
- components/booking.tsx: booking and confirmation
- components/chat.tsx: AI assistant, rule fallback and embedded booking
- app/manage/: customer management
- app/admin/: signed-in administrator
- app/api/workshop/route.ts: all validated data operations
- lib/catalog.ts: prices, services and scheduling rules
- lib/assistant.ts: rule-based replies
- db/schema.ts and drizzle/: database schema and migrations

## Local development
Requires Node 22.13 or newer and npm. Install with npm ci, then npm run dev.
Set ADMIN_EMAIL in local .env and .dev.vars for local admin testing. The portable preview's local sign-in uses seedy@sites.test.
Generate migrations with npm run db:generate; apply only pending files using the procedure in the Sites starter documentation.
Build with npm run build. Real production environment values are configured through Sites and must never be committed.

## Validation
Local API checks covered persistence, retry safety, token access protection, slot conflicts, concurrent reservations, rescheduling, cancellation, past-date rejection, administrator authorization, origin protection and assistant estimates.
Browser checks and final publication results are recorded in the chat.
WebMCP is feature-detected; its browser API was unavailable for native validation in the local browser. This does not affect normal site use.

## Deliberate scope
Slots represent one vehicle's check-in, not a guaranteed repair completion time.
No promise of continuous commercial availability is made by this classroom prototype.


## AI configuration
OPENAI_API_KEY is a server-side Site secret. The model is pinned to gpt-4.1-mini-2025-04-14. Requests have a 25-second timeout and a 700-token output limit. Each IP has a 12-request/minute chat limit. AI_DAILY_REQUEST_LIMIT defaults to 200 requests across the site per UTC day; this request limit is not a currency budget. Key expiration or API failures trigger explicitly labelled rule guidance without affecting bookings. Price cards are generated from lib/catalog.ts.

## Design integration
The Kingsway wheel interaction, grey/steel palette and yellow accents are integrated with Harbour Auto functionality. See DESIGN_INTEGRATION.md for source attribution and scope.

