# Local Setup

## Requirements

- Node.js 22.13.0 or newer and npm.
- Internet access for installing the locked dependencies.
- An optional OpenAI API key for real AI responses. Booking and rule-based guidance do not require a key.

Extract the ZIP into a writable folder. Open a terminal in the folder containing package.json. Do not run the project directly inside the ZIP.

## 1. Install dependencies

~~~sh
npm ci
~~~

The package-lock.json file is included. Preserve it to keep dependency versions consistent across the team. If an installation is incomplete, the starter also provides npm run install:ci.

## 2. Create local environment files

Create a file named .env.local in the project root:

~~~dotenv
ADMIN_EMAIL=seedy@sites.test
OPENAI_API_KEY=
AI_DAILY_REQUEST_LIMIT=200
~~~

Leave OPENAI_API_KEY empty for rule-based guidance, or enter your own key locally. Never paste a key into source code, a shared document, or a group chat.

Create a second file named .dev.vars in the project root:

~~~dotenv
ADMIN_EMAIL=seedy@sites.test
AI_DAILY_REQUEST_LIMIT=200
~~~

The portable development server provides a mock sign-in identity, seedy@sites.test. This identity is only for local testing. The deployed Site uses real authentication and its own administrator setting. Both local files are ignored by Git. The included .env.example contains placeholders only.

## 3. Build and initialize a fresh local database

~~~sh
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stiff_ma_gnuci.sql
~~~

The build generates the Worker configuration used by the database command. Run the initial SQL file once on a fresh local database; repeating it after the tables exist will report that they already exist. This command uses local storage, not the live website's database. It creates empty booking and rate-limit tables. No production bookings are supplied.

For future schema changes, edit db/schema.ts and run npm run db:generate. Apply only new migration files, in order, to each relevant database. Do not reapply the initial migration or delete an existing database to resolve a migration error.

## 4. Start the development server

~~~sh
npm run dev
~~~

Open http://127.0.0.1:5173/ using the address reported by the terminal. Keep the terminal running while testing. Open /admin and use the development sign-in to test administration.

## 5. Verify changes

~~~sh
npx tsc --noEmit
npm run build
~~~

Then follow TEST_CHECKLIST.md. This handoff was assembled from the working project; installation on each teammate's computer still needs to be checked there.

## Deployment

The current application is hosted through Sites using Cloudflare Workers and D1. The build scripts and authentication integration are designed for that environment. A regular static-file host alone will not run bookings or server-side AI.

For the existing live Site, the owner should review changes and publish through the Sites workflow. For a separate deployment, create a separate hosting project, bind its own D1 database as DB, apply the migrations and configure ADMIN_EMAIL, OPENAI_API_KEY and AI_DAILY_REQUEST_LIMIT through the host. Do not reuse the owner's project identity for an independent deployment. Moving to another hosting provider also requires replacing the trusted authentication integration; do not treat incoming user identity headers as trusted on an unprotected server.

## Troubleshooting

- Missing database table: initialize the local database with the command above and use the same persistence directory.
- Administrator access denied: check ADMIN_EMAIL in the local files, restart the server and sign in with the mock local identity.
- Rule-based responses instead of AI: check the local API key, account access, quota and request limits. Booking should remain available.
- Port already used: close the other local server or select another port using npm run dev -- --port 5174.
- Production secrets and bookings are intentionally absent from this package.
