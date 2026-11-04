# Account verification and abuse protection

## Behaviour
- Cloudflare Managed Turnstile protects signup, login, verification-email resend and paid AI calls. Server validation requires success, exact hostname and expected action. Missing token, provider timeout/failure or missing configured keys cannot reach protected work. FAQ/rule-only replies remain usable without a challenge. Logout and existing private booking access remain available.
- Existing chat burst cap: 12 requests/IP/minute, including FAQ and image requests. Added AI attempt budgets: 5/day/guest IP, 20/day/account, 30/day/shared IP, plus existing 50/day/site default. UTC daily windows, atomic D1 counters, no reset on account switching. Attempts may consume allowance even if another budget or provider subsequently rejects them. This conservative policy avoids concurrent overspend. Shared networks may reach limits together; proxies/multiple networks still require the global budget.
- Signup retains 5/IP/15min and adds 10/IP/day; authentication retains 20/IP/15min and adds 10/email/15min. No claim of one human per account. Hashed IP keys are pseudonymous, not anonymous identity proof.
- Email verification is implemented but DISABLED in production (`EMAIL_VERIFICATION_ENABLED=false`). The owner has no custom sending domain or Workers Paid plan; no purchase/upgrade was made. Existing accounts are not auto-verified. When activated, only signed-in email-verified customers can use paid AI; FAQ/booking/account management continue.
- Email tokens: 256 random bits, only SHA-256 digest stored, 30-minute expiry, single-use transaction, bound to signed-in customer, latest resend replaces prior link. Fragment link avoids request/referrer logs and is removed from address bar. User explicitly confirms, so link scanners do not consume it. Resend 1/account/minute and 5/account/day plus 10/IP/15min.
- Delivery failure preserves the account/session for retry, invalidates the failed token and never claims successful delivery. No real verification email has been sent or delivery-tested.

## Activation prerequisites for email
1. Obtain an owner-approved domain and Workers Paid plan; onboard sending domain with Cloudflare Email Service and verify DNS.
2. Add `send_email: [{name:"EMAIL"}]` and configure `EMAIL_FROM` from the verified domain. `PUBLIC_SITE_URL` must be the canonical HTTPS origin.
3. Verify the installed Wrangler/runtime supports the structured Email Service sending API (current dependency predates the feature). Upgrade narrowly if needed, with a local/preview delivery check; do not enable solely from type checks.
4. Test actual receipt, failed sends, existing users and email-link flow on staging; update terms and enable EMAIL_VERIFICATION_ENABLED explicitly only after success.
5. Password recovery remains outside this change.

## Database / release
Apply additive migration `0004_spotty_karen_page.sql` before the new code. It adds nullable customers.email_verified_at and email_verifications. Existing bookings, sessions, customer data and photo access are preserved. Keep server secret in Cloudflare encrypted storage; only the public site key belongs in Git. Deploy with existing secrets preserved. Email binding intentionally absent until prerequisites are met.

## Verification
- `node scripts/check-abuse-protection.mjs`: 37 checks, real in-memory SQLite and actual account handlers, mocked Turnstile/mail; concurrency, cross-account limits, fail-closed provider behaviour, single-use/expiry, wrong-account links, resend and failed sending.
- Local production build account integration suite, booking detail and community regression checks; TypeScript and production build.
- No paid AI test call, live booking or real verification email required. Document live CAPTCHA checks separately from mocks.

## Sources checked 2026-11-04
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/email-service/
- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
