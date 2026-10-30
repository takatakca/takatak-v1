"use client";

import { Bot } from "lucide-react";

import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";

/** TAK bot at the centre, the engines it relays to orbiting on two rings, with relay pulses. */
export function TakbotOrbit({ size = 460, connected }: { size?: number; connected?: ReadonlySet<string> }) {
  const engines = TAKBOT_ENGINES;
  const inner = engines.slice(0, Math.ceil(engines.length / 2));
  const outer = engines.slice(inner.length);

  const ring = (items: typeof engines, radius: number, cls: string) => (
    <div aria-hidden className={`absolute inset-0 ${cls}`}>
      {items.map((e, i) => {
        const angle = (i / items.length) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * radius);
        const y = Math.round(Math.sin(angle) * radius);
        const live = connected?.has(e.key);
        return (
          <span
            key={e.key}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <span
              className={`tk-orbit-chip inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
                live ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-[#0B1B3D]/80 text-white/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-300" : "bg-[#29C3FF]"}`} />
              {e.name.replace(" (open models)", "")}
            </span>
          </span>
        );
      })}
    </div>
  );

  const r1 = size * 0.3;
  const r2 = size * 0.46;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, maxWidth: "100%" }}>
      <div aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(31_139_255/0.35),transparent)] blur-2xl" />
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/12" style={{ width: r1 * 2, height: r1 * 2 }} />
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" style={{ width: r2 * 2, height: r2 * 2 }} />
      <div aria-hidden className="tk-pulse-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#29C3FF]/40" style={{ width: r1 * 2, height: r1 * 2 }} />
      {ring(inner, r1, "tk-orbit")}
      {ring(outer, r2, "tk-orbit-reverse")}
      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center">
        <span className="tk-core-glow grid h-28 w-28 place-items-center rounded-[32px] bg-[linear-gradient(145deg,#1F8BFF,#29C3FF)] text-white shadow-[0_0_60px_rgb(31_139_255/0.7)]">
          <Bot size={44} aria-hidden />
        </span>
        <span className="mt-3 text-sm font-extrabold tracking-[0.2em] text-white">TAK BOT</span>
      </div>
    </div>
  );
}
