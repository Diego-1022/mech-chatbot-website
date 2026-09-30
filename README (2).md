# Harbour Auto — Team Source Code

A classroom car workshop website with online booking, customer booking management, a restricted administrator dashboard, and an OpenAI-powered assistant.

**Live website:** https://harbour-auto-workshop.diegohu1022.chatgpt.site/

The live website was made public on 30 September 2026. This archive is a source-code handoff, not a copy of the production database or hosting account.

## Start here

1. Read **SETUP.md** to run a separate local copy.
2. Read **PROJECT_GUIDE.md** for the architecture and main source files.
3. Read **TEST_CHECKLIST.md** for a classroom demonstration and verification checklist.
4. Use **FILE_MANIFEST.sha256** to check the included file inventory and hashes.

All handoff documentation is in English. The source intentionally retains the existing Chinese translations because the website defaults to English and also offers Chinese as a language option.

## Included functionality

- Six workshop services with fictional AUD price ranges.
- Booking submission at any time, with appointments limited to workshop opening slots in Australia/Sydney time.
- A service/time selection, contact and vehicle form, and a final review step.
- Persistent bookings, conflict protection and retry-safe submission.
- Private links for viewing, rescheduling and cancelling an individual booking.
- An administrator dashboard for viewing appointments, completing or cancelling bookings, and closing or reopening slots.
- An OpenAI assistant for general enquiries, tentative symptom guidance, catalogue estimates and opening the booking form.
- Explicitly labelled rule-based guidance when AI is unavailable.

## Package boundaries

The package includes application source, database schema and migrations, dependency lockfile, build scripts, configuration, assets and third-party licence files. It excludes API keys, actual environment files, Git history, installed dependencies, generated builds, local databases, booking records, logs and private management links.

The existing non-secret Site project ID is retained in .openai/hosting.json for source fidelity. It identifies the owner's deployment; it does not grant teammates access to deploy or administer that Site.

## Scope

This is a fictional classroom project. Prices are teaching data, not real repair quotations. Appointment slots represent vehicle check-in times, not guaranteed repair completion times. Email/SMS notifications and payments are not implemented. Customers must save their private management link after booking.

## Collaboration

Use one shared repository for this source and separate branches for changes. Keep secrets in ignored local files and configure production secrets through the hosting service. Coordinate production changes with the Site owner. Sharing this ZIP does not grant hosting permissions or administrator access.
