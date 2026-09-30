# Kingsway design integration

The interface adapts the user-supplied Kingsway Auto Works design:
https://github.com/subinayadi-ux/Kingsway-site

Reference commit: 38540df83aef0d3a767fdaa26299e97f21d78e42

The primer-grey surfaces, steel navigation, yellow accents, wheel artwork and scroll-led presentation are adapted from that project. The wheel SVG assets are extracted from its rendered artwork. Mobile, short viewports and reduced-motion users can switch the service panels directly instead of scrolling a long track.

Harbour Auto's name, six-service catalogue, fictional AUD ranges, Sydney appointment rules, D1 booking persistence, token-protected management links, authenticated administration and server-side OpenAI integration are retained. The reference site's separate accounts, KV backend, sample phone number and different service promises are not introduced.

Main integration files: app/garage.tsx, app/kingsway.css, app/layout.tsx and public/kingsway-wheel-*.svg. The user supplied the classmate's repository for this team integration; this note is attribution, not a new licence grant for the reference source.
