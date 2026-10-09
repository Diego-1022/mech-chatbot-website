"use client";

import { useEffect, useId, useRef } from "react";
import "./background-paths.css";

/** Decorative curves adapted from the background snippet supplied by the owner.
 * Dash length and offset draw each curve from its left end toward its right end.
 * Geometry is deterministic so SSR and hydration produce identical markup.
 */
export default function BackgroundPaths() {
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paths = Array.from(element.querySelectorAll("path"));
    let inView = true;
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;
    let lastPaint = 0;
    const draw = (time: number) => {
      if (lastTime) elapsed += time - lastTime;
      lastTime = time;
      // Attribute updates match the supplied motion.path effect and avoid
      // WebKit's CSS stroke-animation compositing issue. Limit paint to 30 fps.
      if (time - lastPaint >= 33) {
        paths.forEach((path, index) => {
          const i = index % 28;
          const duration = (20 + (i % 6) * 2) * 1000;
          const phase = ((elapsed + (i * 1.3 + Math.floor(index / 28) * 7) * 1000) % duration) / duration;
          const length = phase < .45 ? .3 + .7 * phase / .45 : 1;
          const offset = phase < .45 ? 0 : -(phase - .45) / .55;
          const opacity = phase < .45 ? .3 + .6 * phase / .45 : phase < .9 ? .9 - .3 * (phase - .45) / .45 : .6 * (1 - phase) / .1;
          path.setAttribute("stroke-dasharray", `${length} 1`);
          path.setAttribute("stroke-dashoffset", String(offset));
          path.setAttribute("opacity", String(opacity));
        });
        lastPaint = time;
      }
      frame = requestAnimationFrame(draw);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      const running = inView && !document.hidden && !reducedMotion.matches;
      element.dataset.running = String(running);
      if (reducedMotion.matches) {
        paths.forEach(path => {
          path.setAttribute("stroke-dasharray", "none");
          path.setAttribute("stroke-dashoffset", "0");
          path.setAttribute("opacity", "1");
        });
      }
      if (running) frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    reducedMotion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return <div className="harbour-paths" ref={root} aria-hidden="true" data-running="false">
    {[1, -1].map((position, group) => <svg key={position} className={`harbour-paths-layer layer-${group}`}
      viewBox="-100 0 800 700" fill="none" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-${group}`} x1="0" y1="0" x2="696" y2="316" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--path-bronze)" />
          <stop offset="0.48" stopColor="var(--path-gold)" />
          <stop offset="1" stopColor="var(--path-silver)" />
        </linearGradient>
      </defs>
      {Array.from({ length: 28 }, (_, i) => <path key={i}
        d={`M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`}
        pathLength="1" strokeDasharray=".3 1" strokeDashoffset="0" stroke={`url(#${id}-${group})`} strokeWidth={0.45 + i * 0.022}
        strokeOpacity={0.23 + i * 0.016}
      />)}
    </svg>)}
  </div>;
}
