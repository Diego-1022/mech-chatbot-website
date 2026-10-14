# Kingsway design integration

The interface adapts the user-supplied Kingsway Auto Works design:
https://github.com/subinayadi-ux/Kingsway-site

Reference commit: 38540df83aef0d3a767fdaa26299e97f21d78e42

The primer-grey surfaces, steel navigation, yellow accents, wheel artwork and scroll-led presentation are adapted from that project. The original wheel SVG assets were extracted from its rendered artwork; the current photographic replacement is described below. Topic buttons remain available. Users who request reduced motion receive a non-sticky presentation without page-driven rotation.

Harbour Auto's name, six-service catalogue, fictional AUD ranges, Sydney appointment rules, D1 booking persistence, token-protected management links, authenticated administration and server-side OpenAI integration are retained. The reference site's separate accounts, KV backend, sample phone number and different service promises are not introduced.

Main integration files: app/garage.tsx, app/kingsway.css, app/layout.tsx and public/kingsway-wheel-*.svg. The user supplied the classmate's repository for this team integration; this note is attribution, not a new licence grant for the reference source.

## Photographic wheel presentation

The owner rejected the modelled wheel's toy-like appearance and requested generated photographic layers informed by sports-car rolling footage. The current wheel uses `components/wheel-showcase.tsx` and `wheel-photographic.css`, with no Three.js/WebGL renderer or 3D geometry dependencies. The complete tyre/rim photograph follows the existing scroll angle as one cutout; the brake disc follows the same angle while the yellow caliper stays fixed behind its transparent spokes. A faint fixed light field is masked by the rotating full-wheel cutout. This is a lightweight visual approximation using photos, not a physically simulated wheel or footage playback.

The built-in image generator edited the project's own neutral wheel into a slender graphite/silver-edged centre-lock design and generated a separate machined brake-disc photograph. The original yellow caliper photo is reused. Genuine cutout alpha reveals the brake layers through the spokes. Selected PNG originals remain in the task's outputs; delivery WebP files preserve dimensions/alpha and use quality92. Exact prompts, output hashes and reference links are in `UI_ASSET_PROMPTS.json`.

Motion/style references observed in the internal browser: [2014 Porsche 911 Turbo S rolling close-up](https://www.youtube.com/watch?v=6HTb2fg_3xs), including the wheel near15.7seconds, and the [official Porsche 911 GT3 RS model film/details](https://www.porsche.com/international/models/911/911-gt3-rs/911-gt3-rs/). These informed photographic materials, slender spokes and the stationary-caliper impression; no Porsche/HRE footage or manufacturer image is shipped as a site asset.

### Common rotation axis

The generated1254px images are not perfectly registered to their canvas centers: the wheel cap ring fits near(626.70,620.57), and the rotor aperture near(627.08,616.45). Rotating the raw image about(627,627) made these centers orbit. Each photo receives its own static percentage translation to the shared50%/50% axle. The complete tyre/rim and brake-disc wrappers rotate at the same angle; only the caliper stays fixed. The alpha-light mask uses the wheel translation, and its gradient counter-rotates about the measured source hub. There is no radial split between tyre and rim: keeping the full photograph together preserves its original irregular boundary at every angle. Recalibrate these values if the source photos change.

The desktop animated stage also uses a zero-minimum grid row, so longer topic text cannot increase the row height and shift the whole wheel. Natural-flow mobile and reduced-motion layouts retain their existing behavior.

## Wheel and page input

Mouse/trackpad scrolling over the circular tyre accumulates unlimited positive or negative rotation; crossing a full turn cycles the four topics without scrolling the page. A non-passive wheel listener exists only on the wheel element. Circular hit testing excludes the transparent corners, and Ctrl+wheel/pinch zoom remains native. No touch scrolling is intercepted.

Away from the tyre, normal desktop page scrolling adds its angular movement to the existing rotation instead of resetting manual turns. Topic controls choose the nearest equivalent angle without programmatic page scrolling. Narrow screens (860px and below) use natural document flow and direct topic selection, so longer descriptions and the booking cue cannot overlap inside a fixed-height stage.

Bilingual wheel/page input hints and a hover ring identify the interaction. Touch devices receive swipe/tap wording. A bold downward cue links to booking; existing reduced-motion CSS disables smooth anchor scrolling. Desktop wheel size leaves room for both the input hints and booking cue on shorter viewports.

## Historical physical wheel experiment (removed)

PR#10 used locally authored Three.js geometry: a lathed tyre and rim barrel, five curved split spokes, a drilled rotor, fasteners and a stationary yellow caliper. Uniform material colours and generated bump textures contained no baked directional illumination. Fixed lights calculated reflections/shadows. The implementation and geometry check were removed when the owner requested photography; their source remains recoverable in Git history.

The historical canvas loaded only when visible, drew on changes and had a layered-image fallback. Current photo layers retain the accessible HTML topic controls and existing reduced-motion selection without a canvas.

PR#11 corrected the model's exposed pad into a generic opposing-pad caliper and validated clearance. It remained an illustrative model rather than a manufacturer CAD replica; the owner still preferred a photographic appearance. [Brembo's fixed-caliper overview](https://www.bremboparts.com/america/en/catalogue/upgradekit/1N3-9506A_) informed that historical arrangement; no manufacturer image or model was copied.
