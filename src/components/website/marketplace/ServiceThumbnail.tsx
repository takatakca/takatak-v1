type Kind =
  | "website" | "mobile" | "logo" | "branding" | "social" | "seo"
  | "data" | "menu" | "flyer" | "ecommerce" | "automation" | "ai";

/**
 * Marketplace thumbnails. Each `kind` maps to a locally-hosted
 * portfolio-style photo under /marketplace/visuals/*.jpg. The pure-CSS
 * mockups below are kept as a fallback for unknown kinds and to avoid
 * a layout shift while the image decodes.
 */
const PHOTO: Record<Kind, string> = {
  website: "/marketplace/visuals/website.jpg",
  ecommerce: "/marketplace/visuals/ecommerce.jpg",
  mobile: "/marketplace/visuals/mobile.jpg",
  logo: "/marketplace/visuals/logo.jpg",
  branding: "/marketplace/visuals/branding.jpg",
  social: "/marketplace/visuals/social.jpg",
  seo: "/marketplace/visuals/seo.jpg",
  data: "/marketplace/visuals/data.jpg",
  menu: "/marketplace/visuals/menu.jpg",
  flyer: "/marketplace/visuals/flyer.jpg",
  automation: "/marketplace/visuals/automation.jpg",
  ai: "/marketplace/visuals/ai.jpg",
};

const ALT: Record<Kind, string> = {
  website: "Website design preview",
  ecommerce: "Online store preview",
  mobile: "Mobile app design preview",
  logo: "Logo design exploration",
  branding: "Brand identity stationery",
  social: "Social media content preview",
  seo: "SEO analytics dashboard",
  data: "Data entry spreadsheet",
  menu: "Menu design preview",
  flyer: "Promotional flyer design",
  automation: "Automation workflow",
  ai: "AI assistant dashboard",
};

export function ServiceThumbnail({ kind }: { kind: Kind }) {
  const src = PHOTO[kind];
  return (
    <div className="relative aspect-[5/3] w-full overflow-hidden border-b border-border bg-gradient-to-br from-secondary to-background">
      {src ? (
        <img
          src={src}
          alt={ALT[kind]}
          loading="lazy"
          decoding="async"
          width={1280}
          height={800}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Mockup kind={kind} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
    </div>
  );
}

function Mockup({ kind }: { kind: Kind }) {
  switch (kind) {
    case "website":
      return <BrowserMock />;
    case "ecommerce":
      return <BrowserMock variant="shop" />;
    case "mobile":
      return <PhoneMock />;
    case "logo":
      return <LogoBoard />;
    case "branding":
      return <BrandingBoard />;
    case "social":
      return <SocialPost />;
    case "seo":
      return <SeoChart />;
    case "data":
      return <DataTable />;
    case "menu":
      return <MenuCard />;
    case "flyer":
      return <FlyerCard />;
    case "automation":
      return <AutomationFlow />;
    case "ai":
      return <ChatMock />;
  }
}

/* -------- Shared atoms -------- */
const bar = "rounded-[2px] bg-foreground/15";

function BrowserMock({ variant }: { variant?: "shop" }) {
  return (
    <div className="w-full h-full bg-card rounded-md shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] border border-border overflow-hidden flex flex-col">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-secondary/60">
        <span className="w-2 h-2 rounded-full bg-foreground/20" />
        <span className="w-2 h-2 rounded-full bg-foreground/20" />
        <span className="w-2 h-2 rounded-full bg-foreground/20" />
        <span className="ml-2 h-2.5 flex-1 rounded-sm bg-foreground/10" />
      </div>
      {variant === "shop" ? (
        <div className="flex-1 flex flex-col">
          {/* shop top nav */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-border">
            <span className="h-1.5 w-8 rounded-[2px] bg-foreground/40" />
            <div className="flex gap-1">
              <span className={`h-1 w-4 ${bar}`} />
              <span className={`h-1 w-4 ${bar}`} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
          </div>
          <div className="p-1.5 grid grid-cols-3 gap-1 flex-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-sm bg-secondary border border-border flex flex-col overflow-hidden">
                <div className={`flex-1 ${i % 3 === 0 ? "bg-primary/15" : i % 3 === 1 ? "bg-foreground/10" : "bg-foreground/15"}`} />
                <div className="p-1 space-y-0.5">
                  <span className={`block h-1 w-3/4 ${bar}`} />
                  <span className="block h-1.5 w-1/3 rounded-[2px] bg-primary/80" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* top nav */}
          <div className="flex items-center justify-between px-2.5 py-1 border-b border-border">
            <span className="h-1.5 w-6 rounded-[2px] bg-foreground/60" />
            <div className="flex gap-1">
              <span className={`h-1 w-3 ${bar}`} />
              <span className={`h-1 w-3 ${bar}`} />
              <span className={`h-1 w-3 ${bar}`} />
              <span className="h-2 w-5 rounded-sm bg-primary" />
            </div>
          </div>
          {/* hero */}
          <div className="px-2.5 py-2 space-y-1 border-b border-border bg-secondary/40">
            <span className={`block h-2 w-2/3 ${bar}`} />
            <span className={`block h-1.5 w-5/6 ${bar}`} />
            <span className="block h-2.5 w-12 rounded-sm bg-primary mt-1" />
          </div>
          {/* feature grid */}
          <div className="p-1.5 grid grid-cols-3 gap-1 flex-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-sm bg-secondary border border-border p-1 flex flex-col gap-0.5">
                <span className="h-1.5 w-1.5 rounded-sm bg-primary/80" />
                <span className={`h-1 w-3/4 ${bar} mt-auto`} />
                <span className={`h-1 w-1/2 ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="h-full flex items-center justify-center gap-2">
      {/* back phone */}
      <Phone tint="muted" className="opacity-80 -rotate-6 scale-90" />
      {/* front phone */}
      <Phone tint="primary" className="z-10 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.45)]" />
      {/* third small */}
      <Phone tint="muted" className="opacity-70 rotate-6 scale-90 hidden sm:block" />
    </div>
  );
}

function Phone({ tint, className = "" }: { tint: "primary" | "muted"; className?: string }) {
  return (
    <div className={`h-[88%] aspect-[9/16] bg-foreground rounded-[12px] p-[3px] ${className}`}>
      <div className="h-full w-full bg-card rounded-[9px] overflow-hidden flex flex-col">
        <div className="h-2.5 flex items-center justify-center">
          <span className="w-5 h-0.5 rounded-full bg-foreground/40" />
        </div>
        <div className="px-1.5 space-y-1 flex-1">
          <div className={`h-3 rounded-sm ${tint === "primary" ? "bg-primary/85" : "bg-foreground/25"}`} />
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-secondary border border-border" />
            <div className="flex-1 space-y-0.5">
              <span className={`block h-0.5 w-3/4 ${bar}`} />
              <span className={`block h-0.5 w-1/2 ${bar}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="aspect-square rounded-sm bg-secondary border border-border" />
            <div className={`aspect-square rounded-sm border border-border ${tint === "primary" ? "bg-primary/20" : "bg-foreground/8"}`} />
          </div>
          <div className="space-y-0.5">
            <span className={`block h-0.5 w-5/6 ${bar}`} />
            <span className={`block h-0.5 w-2/3 ${bar}`} />
            <span className={`block h-0.5 w-1/2 ${bar}`} />
          </div>
        </div>
        <div className="h-2 flex items-center justify-center gap-1 pb-0.5 border-t border-border">
          <span className="w-0.5 h-0.5 rounded-full bg-foreground/40" />
          <span className="w-1 h-1 rounded-full bg-primary" />
          <span className="w-0.5 h-0.5 rounded-full bg-foreground/40" />
        </div>
      </div>
    </div>
  );
}

function LogoBoard() {
  const marks = ["T", "A", "K", "★", "◆", "●"];
  return (
    <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-1.5">
      {marks.map((m, i) => (
        <div
          key={i}
          className="rounded-md bg-card border border-border flex items-center justify-center font-bold text-foreground"
          style={{ fontSize: 18 }}
        >
          <span className={i % 2 ? "text-primary" : "text-foreground"}>{m}</span>
        </div>
      ))}
    </div>
  );
}

function BrandingBoard() {
  return (
    <div className="w-full h-full bg-card rounded-md border border-border p-2 flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1 h-6">
        <div className="rounded-sm bg-primary" />
        <div className="rounded-sm bg-foreground" />
        <div className="rounded-sm bg-foreground/30" />
        <div className="rounded-sm bg-secondary border border-border" />
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="font-extrabold text-foreground leading-none" style={{ fontSize: 22 }}>Aa</div>
        <span className={`mt-1.5 h-1.5 w-2/3 ${bar}`} />
        <span className={`mt-1 h-1 w-1/2 ${bar}`} />
      </div>
    </div>
  );
}

function SocialPost() {
  return (
    <div className="h-full aspect-square bg-card rounded-md border border-border overflow-hidden flex flex-col shadow-sm">
      <div className="flex items-center gap-1.5 p-1.5 border-b border-border">
        <span className="w-3 h-3 rounded-full bg-primary" />
        <span className={`h-1.5 w-12 ${bar}`} />
      </div>
      <div className="flex-1 bg-foreground/8 flex items-center justify-center">
        <span className="text-primary font-bold" style={{ fontSize: 26 }}>#</span>
      </div>
      <div className="p-1.5 space-y-1">
        <span className={`block h-1 w-5/6 ${bar}`} />
        <span className={`block h-1 w-3/5 ${bar}`} />
      </div>
    </div>
  );
}

function SeoChart() {
  const heights = [25, 35, 30, 50, 60, 75, 90];
  return (
    <div className="w-full h-full bg-card rounded-md border border-border p-2 flex flex-col shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)]">
      {/* kpi tiles */}
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        {[
          { v: "1.2k", l: "clicks", up: true },
          { v: "38%", l: "ctr", up: true },
          { v: "4.7", l: "rating", up: false },
        ].map((k) => (
          <div key={k.l} className="rounded-sm border border-border bg-secondary/50 px-1 py-0.5">
            <div className="text-[8px] font-bold text-foreground leading-none">{k.v}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[6px] uppercase text-muted-foreground tracking-wide">{k.l}</span>
              <span className={`text-[6px] font-bold ${k.up ? "text-primary" : "text-foreground/50"}`}>
                {k.up ? "▲" : "•"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-1">
        {heights.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${i === heights.length - 1 ? "bg-primary" : i === heights.length - 2 ? "bg-primary/60" : "bg-foreground/25"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between text-[7px] text-muted-foreground">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
    </div>
  );
}

function DataTable() {
  return (
    <div className="w-full h-full bg-card rounded-md border border-border overflow-hidden flex flex-col">
      <div className="grid grid-cols-4 gap-px bg-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-secondary px-1 py-1">
            <span className={`block h-1 w-3/4 ${bar}`} />
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-rows-5 gap-px bg-border">
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="grid grid-cols-4 gap-px bg-border">
            {Array.from({ length: 4 }).map((_, c) => (
              <div key={c} className="bg-card px-1 flex items-center">
                <span className={`block h-1 ${c === 3 ? "w-1/2 bg-primary/70 rounded-[2px]" : "w-2/3 " + bar}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuCard() {
  return (
    <div className="h-full aspect-[3/4] bg-card rounded-md border border-border p-2.5 flex flex-col shadow-sm">
      <div className="text-center font-extrabold text-foreground" style={{ fontSize: 13 }}>MENU</div>
      <div className="mt-0.5 mx-auto h-px w-8 bg-primary" />
      <div className="mt-2 flex-1 space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`h-1.5 flex-1 ${bar}`} />
            <span className="h-1.5 w-4 rounded-[2px] bg-primary/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlyerCard() {
  return (
    <div className="h-full aspect-[3/4] rounded-md border border-border overflow-hidden flex flex-col bg-card shadow-sm">
      <div className="flex-1 bg-primary/85 p-2 flex flex-col justify-end text-primary-foreground">
        <div className="font-extrabold leading-none" style={{ fontSize: 16 }}>SALE</div>
        <div className="mt-0.5 text-[8px] opacity-90 font-semibold">THIS WEEK ONLY</div>
      </div>
      <div className="p-1.5 space-y-1">
        <span className={`block h-1 w-5/6 ${bar}`} />
        <span className={`block h-1 w-3/5 ${bar}`} />
      </div>
    </div>
  );
}

function AutomationFlow() {
  return (
    <div className="w-full h-full bg-card rounded-md border border-border p-3 flex items-center justify-between gap-1.5">
      {["A", "B", "C"].map((n, i) => (
        <div key={n} className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-md bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-foreground">{n}</div>
          {i < 2 && <div className="w-4 h-px bg-primary" />}
        </div>
      ))}
    </div>
  );
}

function ChatMock() {
  return (
    <div className="w-full h-full bg-card rounded-md border border-border overflow-hidden flex shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)]">
      {/* sidebar */}
      <div className="w-1/4 border-r border-border bg-secondary/60 p-1 flex flex-col gap-1">
        <div className="h-2 rounded-sm bg-primary" />
        <span className={`h-1 w-3/4 ${bar}`} />
        <span className={`h-1 w-1/2 ${bar}`} />
        <span className={`h-1 w-2/3 ${bar}`} />
        <div className="mt-auto h-2 rounded-sm bg-foreground/20" />
      </div>
      {/* chat */}
      <div className="flex-1 p-1.5 flex flex-col gap-1">
        <div className="self-start max-w-[80%] px-1.5 py-1 rounded-md bg-secondary">
          <span className={`block h-1 w-12 ${bar}`} />
          <span className={`block h-1 w-8 mt-0.5 ${bar}`} />
        </div>
        <div className="self-end max-w-[80%] px-1.5 py-1 rounded-md bg-primary">
          <span className="block h-1 w-10 rounded-[2px] bg-primary-foreground/70" />
          <span className="block h-1 w-7 mt-0.5 rounded-[2px] bg-primary-foreground/70" />
        </div>
        <div className="self-start max-w-[80%] px-1.5 py-1 rounded-md bg-secondary">
          <span className={`block h-1 w-14 ${bar}`} />
        </div>
        <div className="mt-auto flex items-center gap-1 rounded-sm border border-border bg-secondary/40 px-1 py-0.5">
          <span className={`flex-1 h-1 ${bar}`} />
          <span className="w-2 h-2 rounded-sm bg-primary" />
        </div>
      </div>
    </div>
  );
}