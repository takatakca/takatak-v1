/** Shared TAKATAK website hero light and dot treatment. Parent must be relative. */
export function BrandHeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 85% -10%, color-mix(in oklab, var(--hero-blue, #1F8BFF) 30%, transparent), transparent 62%), radial-gradient(700px 420px at -10% 110%, color-mix(in oklab, var(--hero-cyan, #29C3FF) 12%, transparent), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--hero-cyan, #29C3FF) 50%, transparent) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse at 70% 30%, black 10%, transparent 70%)",
        }}
      />
    </div>
  );
}
