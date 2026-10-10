# Kingsway design integration

The interface adapts the user-supplied Kingsway Auto Works design:
https://github.com/subinayadi-ux/Kingsway-site

Reference commit: 38540df83aef0d3a767fdaa26299e97f21d78e42

The primer-grey surfaces, steel navigation, yellow accents, wheel artwork and scroll-led presentation are adapted from that project. The wheel SVG assets are extracted from its rendered artwork. The wheel rotates continuously with forward and reverse page scrolling on desktop, narrow preview panes, mobile and short viewports. Topic buttons remain available. Users who request reduced motion receive a non-sticky presentation with direct topic selection instead of scroll animation.

Harbour Auto's name, six-service catalogue, fictional AUD ranges, Sydney appointment rules, D1 booking persistence, token-protected management links, authenticated administration and server-side OpenAI integration are retained. The reference site's separate accounts, KV backend, sample phone number and different service promises are not introduced.

Main integration files: app/garage.tsx, app/kingsway.css, app/layout.tsx and public/kingsway-wheel-*.svg. The user supplied the classmate's repository for this team integration; this note is attribution, not a new licence grant for the reference source.

## Physical wheel rendering

The primary wheel now uses locally authored Three.js geometry in `lib/wheel-scene.ts`: a lathed tyre and rim barrel, five curved split spokes, a drilled rotor, fasteners and a stationary yellow caliper. Uniform rubber/metal material colours and generated bump textures contain no baked directional illumination. Fixed scene lights and an environment map calculate reflections and spoke shadows while the tyre, rim and rotor follow the existing scroll angle. No external model, photograph or paid asset was added for this renderer.

`components/wheel-canvas.tsx` loads the renderer when visible and draws only after rotation, resize or visibility changes; it releases GPU resources on unmount. Phone pixel ratio is capped. The original layered artwork remains the initial and WebGL/context-loss fallback, with the same source attribution. Topic controls stay accessible HTML and preserve the existing reduced-motion behaviour.

Brake geometry in `lib/wheel-brakes.ts` uses a generic fixed-caliper layout: opposing curved pads flank the rotor faces, two cast housing halves enclose them, and an outer bridge clears the rotor edge. All pieces use the wheel axle as a shared origin. This replaces the earlier exposed rectangular pad and separately tilted shell. The caliper clears the barrel and spokes; a pure geometry/raycast check is available with `node --experimental-strip-types scripts/check-wheel-brakes.mjs`. This is an illustrative model, not a dimensioned replica of a particular product. [Brembo's fixed-caliper overview](https://www.bremboparts.com/america/en/catalogue/upgradekit/1N3-9506A_) informed the opposing-pad arrangement; no manufacturer image or model was copied.
