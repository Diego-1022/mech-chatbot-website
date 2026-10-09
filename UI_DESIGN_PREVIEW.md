# UI redesign — preview checkpoint

Prepared 9 October 2026 (Australia/Sydney).

## Current scope

This is the first visual review checkpoint, not a published release. The owner selected a sportier direction: graphite background, a larger wheel and stronger yellow accents. This direction is now applied to the homepage, service cards, booking form, chat shell, private management pages and administrator sign-in shell. The production Worker and GitHub have not been changed.

The homepage now contains a photographic-style transparent wheel foreground and a separate stationary yellow brake caliper. The CSS brake disc sits behind the caliper; the wheel spokes sit in front. Forward/reverse scroll rotates the rim and disc while the caliper stays fixed. Rotation is written to a CSS property in requestAnimationFrame instead of rerendering the entire booking/chat tree on every scroll frame.

New files: `components/wheel-showcase.tsx`, `app/design-preview.css`, `public/wheel-photoreal-v2.png`, `public/caliper-photoreal-v2.png`. Homepage wiring is in `app/garage.tsx`; the shared style import is in `app/layout.tsx`. `components/booking.tsx` adds an accessible progress indicator and step transitions. Original wheel SVGs and design attribution remain available.

## Design references and provenance

21st.dev animated heroes, card layouts and AI chat categories were reviewed as inspiration. No third-party registry component was copied or installed in this checkpoint, and no paid template was purchased. Existing lucide icons and project styling are used.

Wheel assets were generated with the built-in ImageGen tool, not the website's OpenAI API credential. They depict a generic wheel and caliper, not licensed product photography or a specific manufacturer's parts. Full generation prompts are in `UI_ASSET_PROMPTS.json`.

## Verification and limits

- Final TypeScript and Cloudflare build results are recorded in `UI_PREVIEW_VERIFICATION.json`.
- Desktop and 390 × 844 mobile: forward/reverse rotation observed; stationary caliper confirmed; transparent spoke openings inspected.
- English/Chinese rendering checked; no horizontal overflow at 390 px and 320 px.
- Using fictional data on LOCAL D1, a brake appointment was created, opened through its private management link, rescheduled from 09:00 to 10:00, and cancelled successfully. This leaves one cancelled local regression record; no production records were read or changed. The final progress indicator was subsequently checked separately.
- Chat dialog opens and displays its existing initial guidance. Paid AI responses were not exercised.
- Reduced-motion behavior retained in code; OS-level reduced-motion browser testing has not yet been performed.
- Asset alpha channels verified. PNG assets currently total approximately 3 MB; delivery optimization and measured mobile performance are later release tasks.
- Administrator authenticated regression, full adversarial testing, cross-browser testing and production deployment remain outstanding for the final release.

## Continue locally

Run `npm run dev:cloudflare` from this directory after installing the locked dependencies. The preview uses its own local D1 state, not production data. No secrets were added. API-backed chat and administrator authentication require separate authorized local configuration.

Original app source is preserved in the supplied source ZIP; original homepage files also have a task-local backup under `work/ui-baseline`.

## Owner-supplied background reference — 9 October update

The supplied animated Bézier-path snippet is adapted into `components/background-paths.tsx` and `components/background-paths.css`, mounted behind the homepage wheel and copy. Gold (#ffd34c), bronze (#9d783b) and silver (#a6b5b2) are CSS variables. Each SVG curve grows from its left endpoint and then advances toward the right, using animated dash length, offset and opacity. Deterministic 20–30 second cycles are staggered per curve. requestAnimationFrame updates SVG attributes at a maximum of 30 fps; no animation dependency was added. This corrects the earlier drifting-background interpretation and avoids the observed WebKit CSS stroke-animation repaint issue. The text side has a dark gradient overlay. Mobile displays half the paths at lower opacity. The decorative layer ignores pointer input and is hidden from assistive technology. Animations pause when the hero leaves the viewport or the tab is hidden; reduced-motion preferences disable movement.

Desktop and 390 px mobile appearance inspected; mobile horizontal overflow check passed. On-screen dash growth and offset progression confirmed with two browser samples and visual inspections; off-screen pause confirmed in the browser. Reduced-motion rules remain source-verified only. TypeScript and the Cloudflare production build passed after this update. Booking and API logic were not changed.

## PR readiness checks

Changed TSX files were linted and compared with the same files from main. There are eight pre-existing lint errors and three warnings; this change introduces no additional lint errors or warning count increase. The two existing raw-image warnings move from the original homepage to the wheel component. TypeScript and Cloudflare build pass. GitHub main matched the supplied source baseline (526903bccb28629fbceff0f577d4561471c6bed9) when the branch was prepared. No repository CI workflow is configured in that baseline.
