# Project Guide

## Technology

React and TypeScript provide the interface. The application uses Next.js-style App Router files, executed through Vinext and Vite. Tailwind CSS and the included UI components provide styling. Server operations run in a Cloudflare Worker. Cloudflare D1 stores bookings and request counters; Drizzle defines the schema and generates SQL migrations. OpenAI Responses provides optional AI replies.

## Main files

| Path | Purpose |
| --- | --- |
| app/garage.tsx | Homepage, service cards and language-aware content |
| app/page.tsx, app/layout.tsx | Root page and application layout |
| app/globals.css | Global styling |
| components/booking.tsx | Booking steps, review and submission |
| components/chat.tsx | Chat interface, estimate cards and embedded booking |
| components/confirm-action.tsx | Confirmation interface |
| app/manage/ | Private customer booking management |
| app/admin/ | Administrator dashboard |
| app/api/workshop/route.ts | Validated booking, availability, administration and chat operations |
| app/chatgpt-auth.ts | Hosted identity and sign-in helpers |
| lib/catalog.ts | Services, fictional prices, opening slots and scheduling rules |
| lib/client.ts | Client request helpers and language state |
| lib/assistant.ts | Rule-based fallback guidance |
| lib/openai-assistant.ts | Server-side OpenAI request, instructions and structured output handling |
| db/schema.ts | Database tables and constraints |
| db/index.ts | D1 binding access |
| drizzle/ | SQL migration and generation metadata |
| vite.config.ts | Framework, Worker and local preview configuration |
| build/, scripts/, lib/connector* | Starter hosting and preview support |
| components/ui/, hooks/ | Reusable UI components and hooks |
| public/ | Static assets |
| examples/d1/ | Starter database example; not the workshop booking implementation |
| .openai/hosting.json | Non-secret deployment metadata and database binding name |

Keep the starter support files when sharing or building, even if they are not part of the visible workshop interface.

## Booking flow

1. The customer selects a service and a available future Sydney appointment slot.
2. The customer enters contact and vehicle details and reviews the booking.
3. The server validates the request and writes the booking to D1.
4. A database constraint prevents two active reservations from occupying the same slot.
5. The customer receives a private management link. The raw management token appears in the URL fragment; only its hash is stored in D1.
6. Management requests verify the token before allowing access, rescheduling or cancellation.

## Administrator flow

The live hosting layer supplies the authenticated identity. Server-side operations compare the signed-in email with ADMIN_EMAIL. Administrators can view appointments, complete or cancel bookings, and block or reopen slots. A public homepage does not make these operations public.

## Assistant flow

The browser sends a bounded recent chat history to the server. The server calls OpenAI with the key stored in server configuration. The model is pinned to gpt-4.1-mini-2025-04-14. Responses use store:false, a 25-second timeout and a 700-token output limit. Catalogue estimate cards use values from lib/catalog.ts. The chatbot opens a booking form; the customer still reviews and submits the actual booking.

Chat text is sent to OpenAI. Contact fields from the booking form are not automatically included, but any personal information manually typed into chat is part of the chat text. The application does not persist conversation history in D1. Missing credentials, API errors or exhausted request allowances produce clearly labelled rule-based guidance.

The AI allowance defaults to 200 requests across the Site per UTC day. Chat also has a per-IP limit of 12 requests per minute. The daily request allowance is not a monetary spending cap.

## Language and business data

English is the default. Chinese strings are intentional translations supporting the existing language selector. Keep both language branches synchronized when editing text. Service ranges are fictional AUD values. Appointment rules use Australia/Sydney time. Customers can submit bookings at any hour, but workshop appointment slots follow the configured business schedule.
