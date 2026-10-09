"use client";

import { House, ScanLine, ShieldCheck, Settings } from "lucide-react";
import { useId } from "react";

const icons = [House, ScanLine, ShieldCheck, Settings];

/** Neutral material rotates; the tyre and rim light fields stay in world space.
 * The caliper stays still, behind the transparent openings in the rim.
 */
export default function WheelShowcase({ active, titles, onSelect }: {
  active: number;
  titles: string[];
  onSelect: (index: number) => void;
}) {
  const textureFilter = `tyre-detail-${useId().replace(/:/g, "")}`;
  return <div className="kw-wheel kw-wheel-v2">
    <svg className="wheel-texture-filters" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id={textureFilter} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="0" result="grey" />
          <feColorMatrix in="grey" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="rubber" />
          <feGaussianBlur in="rubber" stdDeviation="12" result="bakedLighting" />
          {/* Subtract broad lighting; keep grooves and grain around one grey. */}
          <feComposite in="rubber" in2="bakedLighting" operator="arithmetic" k2="1" k3="-1" k4="0.14" result="detail" />
          {/* Arithmetic also produces alpha=.14; undo unpremultiplication. */}
          <feColorMatrix in="detail" type="matrix" values=".14 0 0 0 0  0 .14 0 0 0  0 0 .14 0 0  0 0 0 0 1" />
        </filter>
      </defs>
    </svg>
    <div className="wheel-orbit" aria-hidden="true" />
    <div className="wheel-ground" aria-hidden="true" />
    <div className="wheel-assembly" aria-hidden="true">
      <div className="wheel-disc">
        {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ transform: `rotate(${i * 15}deg)` }} />)}
      </div>
      <img className="wheel-caliper" src="/caliper-photoreal-v2.png" alt="" width="1024" height="1024" />
      <div className="wheel-tyre-base" />
      <img className="wheel-tyre-texture" src="/wheel-neutral-v3.png" alt="" width="1254" height="1254" style={{filter:`url(#${textureFilter})`}} />
      <img className="wheel-rim" src="/wheel-neutral-v3.png" alt="" width="1254" height="1254" fetchPriority="high" />
      <div className="wheel-material-light"><div className="wheel-fixed-rim-light" /></div>
      <div className="wheel-tyre-light" />
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
