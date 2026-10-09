# Services background video

The Services & estimates section uses the owner's downloaded Runway video as a decorative background. Dark graphite overlays, desaturation, edge fades and nearly opaque service cards keep the foreground readable. The existing homepage wheel and booking logic are unchanged.

- Asset: `public/media/services-parts-loop.mp4`, H.264, 1280×720, 24 fps, 10.041667 seconds, no audio, fast-start MP4.
- Source: owner-supplied Runway Agent video, downloaded 9 October 2026. Encoded with FFmpeg/libx264 CRF 27, slow preset; original download preserved.
- Poster: first frame, JPEG, 1280×720.
- Source is attached only within 240 px of the section. Playback pauses offscreen and when the document is hidden.
- Reduced-motion and data-saving preferences use the static poster. A bilingual pause/play control is provided. Autoplay failure and media errors retain the poster.
- No extra runtime dependencies, production database writes or paid AI calls.

Validation: TypeScript check, dedicated component ESLint, Cloudflare production build, desktop 1440×960 and mobile 390×844 browser previews, real advancing playback time, native loop/muted flags, manual pause/resume, offscreen pause and initial desktop-home video source omission. Mobile document width equals the viewport. Reduced-motion/data-saving paths reviewed in code; OS preferences and additional browser engines were not changed or tested. The video retains its original loop; a frame-perfect seam is not claimed.
