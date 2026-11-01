"use client";

import { useId } from "react";

/**
 * TAK, the TAKATAK robot: an original mascot in the BRAND.md colours (navy
 * visor, electric blue, cyan, white and silver). Pure inline SVG: it floats,
 * blinks, glows and waves; every motion stops with reduced motion.
 */
export function RobotMascot({
  size = 160,
  wave = true,
  className = "",
  title = "TAK, le robot de TAKATAK",
  headOnly = false,
}: {
  size?: number;
  wave?: boolean;
  className?: string;
  title?: string;
  /** Just the head, for avatars. */
  headOnly?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `${name}-${id}`;
  return (
    <svg
      viewBox={headOnly ? "26 0 148 128" : "0 0 200 240"}
      width={size}
      height={headOnly ? (size * 128) / 148 : (size * 240) / 200}
      role="img"
      aria-label={title}
      className={`tk-bot overflow-visible ${className}`}
    >
      <defs>
        <radialGradient id={g("body")} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#E9F0F8" />
          <stop offset="100%" stopColor="#B8C4D3" />
        </radialGradient>
        <linearGradient id={g("visor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1B3D" />
          <stop offset="100%" stopColor="#060D1F" />
        </linearGradient>
        <radialGradient id={g("glow")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#29C3FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#29C3FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("blue")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#29C3FF" />
          <stop offset="100%" stopColor="#1F8BFF" />
        </linearGradient>
      </defs>

      {/* Hover light under the robot */}
      <ellipse className="tk-bot-shadow" cx="100" cy="228" rx="46" ry="7" fill="#1F8BFF" opacity="0.25" />

      <g className="tk-bot-float">
        {/* Antennae */}
        <g className="tk-bot-antenna">
          <path d="M78 34 L70 14" stroke="#B8C4D3" strokeWidth="4" strokeLinecap="round" />
          <path d="M122 34 L130 14" stroke="#B8C4D3" strokeWidth="4" strokeLinecap="round" />
          <circle cx="70" cy="12" r="10" fill={`url(#${g("glow")})`} />
          <circle cx="130" cy="12" r="10" fill={`url(#${g("glow")})`} />
          <circle cx="70" cy="12" r="5" fill="#29C3FF" />
          <circle cx="130" cy="12" r="5" fill="#29C3FF" />
        </g>

        {/* Head */}
        <rect x="42" y="30" width="116" height="92" rx="40" fill={`url(#${g("body")})`} stroke="#B8C4D3" strokeWidth="1.5" />
        {/* Ear pods */}
        <rect x="32" y="62" width="14" height="30" rx="7" fill="#1F8BFF" />
        <rect x="154" y="62" width="14" height="30" rx="7" fill="#1F8BFF" />
        {/* Visor */}
        <rect x="56" y="46" width="88" height="60" rx="26" fill={`url(#${g("visor")})`} />
        <rect x="62" y="50" width="40" height="8" rx="4" fill="#FFFFFF" opacity="0.12" />
        {/* Happy eyes (blink) */}
        <g className="tk-bot-eyes">
          <path d="M74 80 Q82 68 90 80" fill="none" stroke="#29C3FF" strokeWidth="6" strokeLinecap="round" />
          <path d="M110 80 Q118 68 126 80" fill="none" stroke="#29C3FF" strokeWidth="6" strokeLinecap="round" />
        </g>
        {/* Smile */}
        <path d="M92 92 Q100 98 108 92" fill="none" stroke="#29C3FF" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />

        {/* Neck */}
        <rect x="88" y="120" width="24" height="10" rx="4" fill="#B8C4D3" />

        {/* Body */}
        <path d="M58 140 Q58 128 72 128 L128 128 Q142 128 142 140 L148 190 Q150 206 132 206 L68 206 Q50 206 52 190 Z" fill={`url(#${g("body")})`} stroke="#B8C4D3" strokeWidth="1.5" />
        {/* Chest badge: the upward arrow of the brand, in a glowing ring */}
        <circle cx="100" cy="166" r="20" fill="#060D1F" />
        <circle cx="100" cy="166" r="20" fill="none" stroke={`url(#${g("blue")})`} strokeWidth="3" className="tk-bot-core" />
        <path d="M92 174 L100 158 L108 174" fill="none" stroke="#29C3FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Left arm: holds a small tablet */}
        <g>
          <path d="M58 146 Q38 160 40 182" fill="none" stroke="#B8C4D3" strokeWidth="10" strokeLinecap="round" />
          <rect x="22" y="176" width="34" height="24" rx="5" fill="#0B1B3D" stroke="#1F8BFF" strokeWidth="2" />
          <path d="M30 192 L36 186 L41 190 L48 182" fill="none" stroke="#29C3FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Right arm: waves */}
        <g className={wave ? "tk-bot-wave" : ""}>
          <path d="M142 146 Q164 136 168 112" fill="none" stroke="#B8C4D3" strokeWidth="10" strokeLinecap="round" />
          <circle cx="168" cy="106" r="11" fill={`url(#${g("body")})`} stroke="#B8C4D3" strokeWidth="1.5" />
        </g>

        {/* Hover jets */}
        <ellipse cx="80" cy="210" rx="9" ry="4" fill="#1F8BFF" />
        <ellipse cx="120" cy="210" rx="9" ry="4" fill="#1F8BFF" />
        <ellipse className="tk-bot-jet" cx="80" cy="218" rx="6" ry="6" fill={`url(#${g("glow")})`} />
        <ellipse className="tk-bot-jet" cx="120" cy="218" rx="6" ry="6" fill={`url(#${g("glow")})`} />
      </g>
    </svg>
  );
}
