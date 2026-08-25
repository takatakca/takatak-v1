/**
 * Five designed depth layers behind the hero. Purely decorative: every layer
 * is aria-hidden and none of it carries meaning the copy does not already
 * state.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1 — deep graphite foundation */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_100%,transparent),color-mix(in_oklab,var(--background)_92%,black))]" />

      {/* 2 — environmental lighting, one coherent source from the upper right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 620px at 76% -12%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 60%), radial-gradient(900px 520px at -10% 110%, color-mix(in oklab, var(--brand-accent-cyan) 12%, transparent), transparent 62%)",
        }}
      />

      {/* 3 — perspective architectural grid */}
      <div className="absolute inset-x-0 bottom-0 top-1/3 [perspective:700px]">
        <div
          className="tk-grid-drift absolute inset-0 origin-bottom opacity-[0.10]"
          style={{
            transform: "rotateX(64deg)",
            backgroundImage:
              "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "linear-gradient(to top, black, transparent 78%)",
          }}
        />
      </div>

      {/* 4 — fine technical network pattern */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--primary) 45%, transparent) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse at 62% 34%, black 12%, transparent 72%)",
        }}
      />

      {/* 5 — oversized brand geometry, only visible on close inspection */}
      <span className="absolute -left-6 bottom-[-4%] hidden select-none text-[22vw] font-black leading-none tracking-tighter text-foreground/[0.028] lg:block">
        TAKATAK
      </span>

      {/* handoff into the next section */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--background)_88%,black))]" />
    </div>
  );
}