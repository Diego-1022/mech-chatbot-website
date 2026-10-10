"use client";

import { useEffect, useRef } from "react";
import "./wheel-canvas.css";

/** Lazy client-only WebGL. The existing layered image stays visible until the
 * first successful render and returns if WebGL is unavailable or lost.
 */
export default function WheelCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const root = element?.closest<HTMLElement>(".kw-wheel");
    const rotationSource = element?.closest<HTMLElement>(".kw-wheel-area");
    if (!element || !root || !rotationSource) return;
    let scene: ReturnType<typeof import("@/lib/wheel-scene").createWheelScene> | undefined;
    let cancelled = false, visible = true, loading = false, failed = false, frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let degrees = parseFloat(rotationSource.style.getPropertyValue("--wheel-rotation")) || 0;
    function draw() {
      frame = 0;
      if (!scene || !visible || document.hidden || cancelled) return;
      try {
        scene.render(degrees);
        const stats = scene.stats();
        // Non-sensitive render diagnostics support responsive/performance QA.
        element!.dataset.angle = String(degrees);
        element!.dataset.drawCalls = String(stats.drawCalls);
        element!.dataset.triangles = String(stats.triangles);
        element!.dataset.caliperAngle = String(stats.fixedCaliperAngle);
        element!.dataset.clearAlpha = String(stats.clearAlpha);
        element!.dataset.renders = String(stats.renders);
        root!.dataset.renderer = "webgl";
      } catch { fallback(); }
    }
    function schedule() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function fallback() {
      failed = true;
      root!.dataset.renderer = "image";
      cancelAnimationFrame(frame); frame = 0;
      scene?.dispose(); scene = undefined;
    }
    function rotate(event: Event) {
      const next = (event as CustomEvent<number>).detail;
      if (Number.isFinite(next)) { degrees = next; schedule(); }
    }
    function resize() {
      const box = element!.getBoundingClientRect();
      scene?.resize(box.width, box.height); schedule();
    }
    function visibility() { if (!document.hidden) schedule(); }
    function motion() { schedule(); }
    function lost(event: Event) { event.preventDefault(); fallback(); }
    async function initialise() {
      if (scene || cancelled || loading || failed) return;
      loading = true;
      try {
        const { createWheelScene } = await import("@/lib/wheel-scene");
        if (cancelled) return;
        scene = createWheelScene(element!); resize();
      } catch { fallback(); }
      finally { loading = false; }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { void initialise(); schedule(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    const sizeObserver = new ResizeObserver(resize);
    observer.observe(element); sizeObserver.observe(element);
    rotationSource.addEventListener("harbour-wheel-rotate", rotate);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    element.addEventListener("webglcontextlost", lost);
    return () => {
      cancelled = true; cancelAnimationFrame(frame); observer.disconnect(); sizeObserver.disconnect();
      rotationSource.removeEventListener("harbour-wheel-rotate", rotate);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
      element.removeEventListener("webglcontextlost", lost);
      scene?.dispose(); root.dataset.renderer = "image";
    };
  }, []);
  return <canvas className="wheel-webgl" ref={canvas} aria-hidden="true" />;
}
