# Deploying Harbour Auto to your Cloudflare account

This deployment uses Cloudflare Workers and D1 directly. The existing Sites website remains separate and is not changed by these commands. Start with Workers Free; no paid subscription is enabled by the project.

## Current deployment

Public website: https://harbour-auto-workshop.diegohu1022.workers.dev

Administrator sign-in: https://harbour-auto-workshop.diegohu1022.workers.dev/admin/login

Deployed and checked on 6 October 2026. Online checks covered booking creation, retry safety, private access, slot conflicts, rescheduling, cancellation, administrator access, logout, FAQ replies and wheel scrolling at 1280x900, 760x900, 1280x600 and 390x844. Test bookings were cancelled. Existing Sites records are not copied into this separate database.

## Account and database

1. Install the locked dependencies with `npm ci`.
2. Run `npx wrangler login` and authorize your own Cloudflare account.
3. Create a database with `npx wrangler d1 create harbour-auto-db`.
4. Put its returned database ID in `wrangler.cloudflare.json`, preserving the `DB` binding and `drizzle` migrations directory. Database IDs are configuration, not secrets.
5. Run `npm run db:cloudflare:remote` to apply the initial schema to this new database. This does not copy any records from the old Sites database.

## Administrator and API secrets

Use the hosting account's secret store for `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` and `OPENAI_API_KEY`. The administrator password must be at least 20 characters; generate a random one. The session secret must be at least 32 characters and should also be random. Never put real values in Git, build variables, or client code.

The administrator uses `/admin/login`. Sessions last eight hours and use a signed HttpOnly, SameSite=Strict cookie, with Secure enabled on HTTPS. Incoming Sites identity headers cannot grant access. Login attempts are limited to five per IP per 15-minute window. Rotate the session secret to invalidate existing sessions. Changing only the password does not revoke already issued sessions.

`ADMIN_EMAIL` in the Worker configuration identifies the sole administrator internally; this is a password sign-in, not email delivery or a customer account system. Customers continue using private booking links.

## Build and deploy

```
npm run build:cloudflare
npm run deploy:cloudflare
```

The build removes any `.dev.vars` or `.env` files copied into `dist` by the preview tooling. The deploy command refuses the placeholder database ID or a mismatched generated configuration. The Worker name defaults to `harbour-auto-workshop`. Cloudflare supplies a `workers.dev` URL; no purchased domain is required.

Configure the secrets before sharing the deployed site. Through Wrangler, secret commands must target the standalone Worker/configuration. An ignored `.cloudflare-secrets.json` can be used with `wrangler secret bulk`; never upload it to GitHub. `.cloudflare-admin.txt`, when present, is a private local password handoff, not a public project document.

For local development, run `npm run db:cloudflare:local`, configure the administrator secrets in ignored `.dev.vars`, then `npm run dev:cloudflare`. The local database lives in `.wrangler/cloudflare-state`, separately from the previous Sites preview database.

## Cost controls

- Standard opening-hours, contact, booking-entry and service-price questions use deterministic replies with no OpenAI request.
- AI defaults to 50 requests per UTC day across the whole site. Set `AI_DAILY_REQUEST_LIMIT` to `0` to disable AI calls; basic guidance and bookings remain available.
- AI uses at most four recent messages and a 450-token output cap. Per-IP chat limits remain enabled.
- A daily request allowance is not a monetary spending cap. API billing is separate from Cloudflare billing.
- Workers Free has a CPU limit as well as a request limit. Validate real traffic and CPU usage before assuming the free tier is sufficient. Do not enable paid plans automatically.

## Migration and GitHub

The existing Sites bookings, URLs and secrets are not automatically migrated. Keep the old site available until the new deployment is tested and any required record transfer is planned. Old private management links still point to the old site.

Once this configuration includes a real D1 ID, connect the relevant GitHub branch to Workers Builds. Use `npm run build:cloudflare` as the build command and `npm run deploy:cloudflare` as the deploy command. Keep production secrets in the Worker secret store, not the build environment. Only enable automatic deployment for the branch the team has approved.
