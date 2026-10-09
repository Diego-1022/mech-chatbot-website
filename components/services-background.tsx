"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** Owner-supplied Runway clip. Load only near the services section. */
export default function ServicesBackground({ lang }: { lang: "en" | "zh" }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    const film = video.current;
    if (!element || !film) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let nearby = false;
    let visible = false;
    const update = () => {
      const allowed = !paused && !reduced.matches && !connection?.saveData;
      if (nearby && allowed && !film.getAttribute("src")) {
        film.src = "/media/services-parts-loop.mp4";
        film.preload = "auto";
        film.load();
      }
      const running = visible && allowed && !document.hidden;
      element.dataset.motion = running ? "running" : "static";
      if (running) {
        film.play().catch(() => { element.dataset.motion = "static"; });
      } else {
        film.pause();
      }
    };
    const prepare = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      update();
    }, { rootMargin: "240px 0px" });
    const playback = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    prepare.observe(element);
    playback.observe(element);
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      prepare.disconnect();
      playback.disconnect();
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      film.pause();
    };
  }, [paused]);

  return <>
    <div className="services-film" ref={root} aria-hidden="true" data-motion="static">
      <div className="services-film-viewport">
        <video ref={video} muted loop playsInline preload="none" tabIndex={-1}
          poster="/media/services-parts-poster.jpg" disablePictureInPicture
          onPlaying={() => { if (root.current) root.current.dataset.ready = "true"; }}
          onError={() => { if (root.current) root.current.dataset.ready = "false"; }} />
      </div>
    </div>
    <button type="button" className="services-motion-toggle" aria-pressed={paused}
      aria-label={lang === "zh" ? (paused ? "播放背景动画" : "暂停背景动画") : (paused ? "Play background animation" : "Pause background animation")}
      onClick={() => setPaused(value => !value)}>
      {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
      {lang === "zh" ? (paused ? "播放背景" : "暂停背景") : (paused ? "Play background" : "Pause background")}
    </button>
  </>;
}
