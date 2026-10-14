"use client";

import { House, ScanLine, ShieldCheck, Settings } from "lucide-react";
import "./wheel-photographic.css";

const icons = [House, ScanLine, ShieldCheck, Settings];

/** The whole tyre/rim cutout rotates as one image. The brake disc follows
 * the same angle; only the caliper stays fixed behind the spoke openings.
 */
export default function WheelShowcase({ active, titles, onSelect }: {
  active: number;
  titles: string[];
  onSelect: (index: number) => void;
}) {
  return <div className="kw-wheel kw-wheel-v2" data-renderer="photographic" aria-describedby="wheel-input-guide">
    <div className="wheel-orbit" aria-hidden="true" />
    <div className="wheel-ground" aria-hidden="true" />
    <div className="wheel-photo-assembly" aria-hidden="true">
      <div className="wheel-photo-disc"><img src="/media/brake-disc-photo-v4.webp" alt="" width="1254" height="1254" /></div>
      <img className="wheel-photo-caliper" src="/media/caliper-photo-v4.webp" alt="" width="1254" height="1254" />
      <div className="wheel-photo-wheel"><img src="/media/wheel-photo-v4.webp" alt="" width="1254" height="1254" fetchPriority="high" /></div>
      <div className="wheel-photo-rim-light"><div className="wheel-photo-rim-mask"><div className="wheel-photo-fixed-light" /></div></div>
    </div>
    {icons.map((Icon, i) => {
      const radians = (i * 90 - 90) * Math.PI / 180;
      return <button key={i} type="button" className={"kw-marker" + (active === i ? " active" : "")}
        style={{ left: `${50 + 46 * Math.cos(radians)}%`, top: `${50 + 46 * Math.sin(radians)}%` }}
        aria-label={titles[i]} aria-pressed={active === i} onClick={() => onSelect(i)}>
        <Icon size={20} />
      </button>;
    })}
    <span className="wheel-spec" aria-hidden="true">HARBOUR / PRECISION IN MOTION</span>
  </div>;
}
