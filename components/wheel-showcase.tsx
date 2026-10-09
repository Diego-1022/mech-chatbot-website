"use client";

import { House, ScanLine, ShieldCheck, Settings } from "lucide-react";

const icons = [House, ScanLine, ShieldCheck, Settings];

/** The caliper stays still, behind the transparent openings in the rim. */
export default function WheelShowcase({ active, titles, onSelect }: {
  active: number;
  titles: string[];
  onSelect: (index: number) => void;
}) {
  return <div className="kw-wheel kw-wheel-v2">
    <div className="wheel-orbit" aria-hidden="true" />
    <div className="wheel-ground" aria-hidden="true" />
    <div className="wheel-assembly" aria-hidden="true">
      <div className="wheel-disc">
        {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ transform: `rotate(${i * 15}deg)` }} />)}
      </div>
      <img className="wheel-caliper" src="/caliper-photoreal-v2.png" alt="" width="1024" height="1024" />
      <img className="wheel-rim" src="/wheel-photoreal-v2.png" alt="" width="1024" height="1024" fetchPriority="high" />
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
