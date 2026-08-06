const ITEMS = [
    "10% off your first TAKATAK service",
    "Websites, logos, hosting, marketing and business tools",
    "Managed delivery through TAKATAK",
    "QMAPS local visibility",
    "FLEXS lead generation",
    "Secure project workspace",
    "Human-managed quality control",
  ];
  
  export function PromoMarquee() {
    const loop = [
      ...ITEMS,
      ...ITEMS,
    ];
  
    return (
      <div className="overflow-hidden border-y border-border bg-card/40">
        <div
          className="flex gap-12 whitespace-nowrap py-3 text-sm"
          style={{
            animation:
              "promoMarquee 60s linear infinite",
          }}
        >
          {loop.map((text, index) => (
            <span
              key={`${text}-${index}`}
              className="inline-flex items-center gap-2 text-foreground/80"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
              {text}
            </span>
          ))}
        </div>
  
        <style>{`
          @keyframes promoMarquee {
            from {
              transform: translateX(0);
            }
  
            to {
              transform: translateX(-50%);
            }
          }
  
          @media (prefers-reduced-motion: reduce) {
            [style*="promoMarquee"] {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    );
  }