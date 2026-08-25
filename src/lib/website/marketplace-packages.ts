/** Demo catalog of TAKATAK marketplace packages.
 *  All listings are TAKATAK-mediated: clients pay TAKATAK, TAKATAK assigns
 *  a vetted Groupe TAKATAK freelancer, and payment is released only after
 *  client approval and the grace period. Used by the search results, the
 *  /marketplace homepage strips and the gig detail page when the backend
 *  has no published packages yet. */

export type ThumbKind =
  | "website" | "mobile" | "logo" | "branding" | "social" | "seo"
  | "data" | "menu" | "flyer" | "ecommerce" | "automation" | "ai";

export interface PackageTier {
  name: "Basic" | "Standard" | "Premium";
  priceCents: number;
  deliveryDays: number;
  revisions: number | "Unlimited";
  includes: string[];
}

export interface PackageAddon {
  label: string;
  priceCents: number;
  deliveryDays?: number;
}

export interface PackageFaq { q: string; a: string }

export interface MarketplacePackageDetail {
  id: string;
  /** URL-safe slug. Defaults to `id`. */
  slug: string;
  title: string;
  category: string;
  categoryName: string;
  /** Short marketing line shown on cards. */
  blurb: string;
  /** Alias for blurb, kept for API parity. */
  shortDescription: string;
  /** Long-form description shown on detail page. */
  description: string;
  thumb: ThumbKind;
  rating: number;
  reviews: number;
  /** Human-readable delivery estimate, derived from the fastest tier. */
  deliveryEstimate: string;
  tiers: PackageTier[];
  addons: PackageAddon[];
  faq: PackageFaq[];
  /** Concrete deliverables list — appears on detail "What you get". */
  deliverables: string[];
  /** Search tags. */
  tags: string[];
  /** Aliased to `tags` for compat. */
  keywords: string[];
  /** Related TAKATAK service key (mirrors src/lib/services.ts). */
  relatedServiceKey: string;
  /** Whether the package requires an AI/managed intake form. */
  intakeRequired: boolean;
  /** Whether the client can request a custom quote instead of buying tiers. */
  quoteAvailable: boolean;
  /** Primary CTA label on the detail page. */
  ctaText: string;
}

function tier(name: PackageTier["name"], price: number, days: number, revisions: PackageTier["revisions"], includes: string[]): PackageTier {
  return { name, priceCents: price * 100, deliveryDays: days, revisions, includes };
}

function addon(label: string, price: number, deliveryDays?: number): PackageAddon {
  return { label, priceCents: price * 100, deliveryDays };
}

type Input = Omit<MarketplacePackageDetail,
  | "slug" | "shortDescription" | "deliveryEstimate" | "keywords"
  | "intakeRequired" | "quoteAvailable" | "ctaText" | "deliverables"
> & Partial<Pick<MarketplacePackageDetail,
  | "deliverables" | "intakeRequired" | "quoteAvailable" | "ctaText"
>>;

function mk(p: Input): MarketplacePackageDetail {
  const minDays = Math.min(...p.tiers.map((t) => t.deliveryDays));
  const maxDays = Math.max(...p.tiers.map((t) => t.deliveryDays));
  const delivery = minDays === maxDays ? `${minDays} days` : `${minDays}–${maxDays} days`;
  const deliverables =
    p.deliverables && p.deliverables.length
      ? p.deliverables
      : Array.from(new Set(p.tiers.flatMap((t) => t.includes))).slice(0, 6);
  return {
    ...p,
    slug: p.id,
    shortDescription: p.blurb,
    deliveryEstimate: delivery,
    keywords: p.tags,
    deliverables,
    intakeRequired: p.intakeRequired ?? false,
    quoteAvailable: p.quoteAvailable ?? true,
    ctaText: p.ctaText ?? "Continue",
  };
}

const FAQ_OWNERSHIP: PackageFaq = {
  q: "Who owns the final files?",
  a: "You own all deliverables, source files and accounts. TAKATAK transfers everything to you on completion.",
};
const FAQ_REVISIONS: PackageFaq = {
  q: "What if I'm not satisfied?",
  a: "Request a revision from your TAKATAK workspace. If we can't resolve it, open a dispute and TAKATAK mediates — we'll reassign a freelancer at no extra cost.",
};
const FAQ_COMMS: PackageFaq = {
  q: "Do I talk to the freelancer directly?",
  a: "All communication runs through your TAKATAK workspace. TAKATAK reviews every delivery before it reaches you.",
};

export const MARKETPLACE_PACKAGES: MarketplacePackageDetail[] = [
  // ───────────────── WEBSITE DEVELOPMENT ─────────────────
  mk({
    id: "website-starter", title: "Starter business website",
    category: "website_design", categoryName: "Website Development",
    blurb: "A clean, responsive 5-page website for your business.",
    description: "TAKATAK assigns a vetted developer to design and ship a professional WordPress or Next.js website tailored to your business. Mobile responsive, contact form and on-page SEO basics included. TAKATAK reviews the work and only releases payment after you approve.",
    thumb: "website", rating: 4.9, reviews: 184,
    tiers: [
      tier("Basic", 299, 7, 2, ["Up to 3 pages", "Mobile responsive", "Contact form", "Basic on-page SEO"]),
      tier("Standard", 549, 10, 3, ["Up to 5 pages", "Custom design", "Blog/news section", "On-page SEO", "Google Analytics setup"]),
      tier("Premium", 999, 14, "Unlimited", ["Up to 8 pages", "Advanced custom design", "Booking or quote form", "Speed optimization", "1 month of support"]),
    ],
    addons: [addon("Extra page", 49, 1), addon("Multilingual setup (FR/EN)", 129, 3), addon("Logo design", 99, 3)],
    faq: [FAQ_OWNERSHIP, FAQ_COMMS, FAQ_REVISIONS],
    tags: ["website", "web", "site", "wordpress", "landing", "business"],
    relatedServiceKey: "websites", intakeRequired: true,
  }),
  mk({
    id: "website-restaurant", title: "Restaurant website",
    category: "website_design", categoryName: "Website Development",
    blurb: "Menu, hours, reservations and Google Maps — all in one site.",
    description: "A restaurant-focused site with online menu, reservations or order links, photo gallery and location map. Delivered by a TAKATAK developer with experience in food & beverage clients.",
    thumb: "website", rating: 4.8, reviews: 72,
    tiers: [
      tier("Basic", 349, 7, 2, ["Menu + hours + map", "Mobile responsive", "Contact form"]),
      tier("Standard", 649, 10, 3, ["Online menu (PDF + HTML)", "Reservation link", "Photo gallery", "Basic SEO"]),
      tier("Premium", 1199, 14, "Unlimited", ["Online ordering integration", "Multilingual (FR/EN)", "Google Business sync", "Speed optimization"]),
    ],
    addons: [addon("Online ordering setup", 199, 5), addon("QR menu", 49, 1), addon("Photo retouching", 79, 3)],
    faq: [FAQ_OWNERSHIP, FAQ_COMMS],
    tags: ["restaurant", "menu", "food", "cafe", "reservation"],
    relatedServiceKey: "websites", intakeRequired: true,
  }),
  mk({
    id: "landing-page", title: "High-conversion landing page",
    category: "website_design", categoryName: "Website Development",
    blurb: "A single, focused page built to convert leads.",
    description: "One conversion-focused landing page with hero, social proof, lead form and tracking. Ideal for ad campaigns, product launches and lead generation.",
    thumb: "website", rating: 4.9, reviews: 121,
    tiers: [
      tier("Basic", 199, 5, 2, ["1 section-based page", "Lead form", "Mobile responsive"]),
      tier("Standard", 379, 7, 3, ["Custom design", "Lead form + email notifications", "Analytics + pixel setup"]),
      tier("Premium", 699, 10, "Unlimited", ["A/B variant", "CRM integration", "Speed optimization", "30-day support"]),
    ],
    addons: [addon("Extra variant", 149, 3), addon("Copywriting", 199, 3)],
    faq: [FAQ_OWNERSHIP, FAQ_REVISIONS],
    tags: ["landing", "page", "lead", "ads", "conversion"],
    relatedServiceKey: "websites",
  }),
  mk({
    id: "ecommerce-shopify", title: "Ecommerce store setup",
    category: "ecommerce_setup", categoryName: "Website Development",
    blurb: "Launch-ready Shopify or WooCommerce store.",
    description: "A fully configured online store: theme, products, payments, taxes and shipping rules. The TAKATAK specialist picks the right platform for your goals (Shopify for fast launches, WooCommerce for full control).",
    thumb: "ecommerce", rating: 4.9, reviews: 88,
    tiers: [
      tier("Basic", 349, 7, 2, ["Theme setup", "Up to 10 products", "Payments + shipping"]),
      tier("Standard", 649, 12, 3, ["Custom theme tweaks", "Up to 30 products", "Tax + multi-currency", "Email confirmations"]),
      tier("Premium", 1199, 18, "Unlimited", ["Theme customization", "Up to 75 products", "Apps & integrations", "Abandoned cart setup", "30 days support"]),
    ],
    addons: [addon("Extra 10 products", 79, 2), addon("Migration from another platform", 199, 5)],
    faq: [{ q: "Which platform?", a: "TAKATAK recommends Shopify for speed and WooCommerce for full control. We advise based on your brief." }, FAQ_OWNERSHIP],
    tags: ["ecommerce", "shop", "shopify", "woocommerce", "store"],
    relatedServiceKey: "websites", intakeRequired: true,
  }),
  mk({
    id: "booking-website", title: "Booking & appointments website",
    category: "website_design", categoryName: "Website Development",
    blurb: "Let customers book services online, 24/7.",
    description: "A website with integrated booking calendar, payments and email reminders — ideal for salons, clinics, consultants and trades.",
    thumb: "website", rating: 4.7, reviews: 54,
    tiers: [
      tier("Basic", 399, 7, 2, ["Booking calendar", "1 service", "Email reminders"]),
      tier("Standard", 699, 10, 3, ["Multi-service booking", "Online payments", "Staff scheduling"]),
      tier("Premium", 1199, 14, "Unlimited", ["Multi-location", "CRM sync", "SMS reminders", "Reports"]),
    ],
    addons: [addon("Stripe payments setup", 99, 2), addon("SMS reminders", 79, 2)],
    faq: [FAQ_OWNERSHIP, FAQ_COMMS],
    tags: ["booking", "appointment", "calendar", "schedule"],
    relatedServiceKey: "websites",
  }),
  mk({
    id: "website-redesign", title: "Website redesign & speed-up",
    category: "website_design", categoryName: "Website Development",
    blurb: "Modernize your existing site and triple page speed.",
    description: "TAKATAK audits your current site, redesigns the layout, rewrites slow sections and ships a faster, modern version — keeping your existing URLs and SEO.",
    thumb: "website", rating: 4.8, reviews: 67,
    tiers: [
      tier("Basic", 449, 10, 2, ["Audit + redesign of 3 pages", "Speed optimization"]),
      tier("Standard", 799, 14, 3, ["Up to 8 pages", "Speed + SEO audit", "Mobile rework"]),
      tier("Premium", 1499, 21, "Unlimited", ["Full site rebuild", "Migration plan", "Tracking setup", "30-day support"]),
    ],
    addons: [addon("Content rewrite (5 pages)", 249, 5)],
    faq: [FAQ_OWNERSHIP, FAQ_REVISIONS],
    tags: ["redesign", "rebuild", "speed", "optimize"],
    relatedServiceKey: "websites",
  }),

  // ───────────────── MOBILE APP DESIGN ─────────────────
  mk({
    id: "app-ui-prototype", title: "Mobile app UI prototype",
    category: "mobile_app_design", categoryName: "Mobile App Design",
    blurb: "A clickable Figma prototype of your app idea.",
    description: "TAKATAK pairs you with a product designer to turn your app idea into a clickable Figma prototype — usable for investor demos, user testing or developer hand-off.",
    thumb: "mobile", rating: 4.8, reviews: 46,
    tiers: [
      tier("Basic", 299, 7, 2, ["Up to 8 screens", "Clickable Figma prototype"]),
      tier("Standard", 599, 10, 3, ["Up to 15 screens", "Light + dark mode", "Design system tokens"]),
      tier("Premium", 1099, 14, "Unlimited", ["Up to 30 screens", "Full design system", "Animated interactions", "Developer hand-off doc"]),
    ],
    addons: [addon("Extra 5 screens", 149, 3), addon("Icon set", 99, 2)],
    faq: [FAQ_OWNERSHIP],
    tags: ["app", "mobile", "prototype", "figma", "ui"],
    relatedServiceKey: "mobile_apps", intakeRequired: true,
  }),
  mk({
    id: "customer-app", title: "Customer-facing mobile app",
    category: "mobile_app_design", categoryName: "Mobile App Design",
    blurb: "iOS + Android app design ready for build.",
    description: "A complete UI design package for a customer-facing app (loyalty, ordering, bookings, content). Delivered as a developer-ready Figma file with a design system.",
    thumb: "mobile", rating: 4.7, reviews: 32,
    tiers: [
      tier("Basic", 799, 14, 2, ["Up to 20 screens", "iOS + Android adaptations"]),
      tier("Standard", 1399, 21, 3, ["Up to 35 screens", "Design system", "Onboarding flow"]),
      tier("Premium", 2499, 28, "Unlimited", ["Up to 60 screens", "Animations", "Hand-off + dev specs"]),
    ],
    addons: [addon("Marketing landing page", 299, 5)],
    faq: [FAQ_OWNERSHIP, FAQ_COMMS],
    tags: ["app", "customer", "mobile", "ios", "android"],
    relatedServiceKey: "mobile_apps", intakeRequired: true,
  }),
  mk({
    id: "business-dashboard-app", title: "Business dashboard app",
    category: "mobile_app_design", categoryName: "Mobile App Design",
    blurb: "Internal app UI for staff, drivers or field teams.",
    description: "Internal-tool app design for operations, dispatch, field service or sales teams. Focused on speed and clarity, not marketing polish.",
    thumb: "mobile", rating: 4.7, reviews: 21,
    tiers: [
      tier("Basic", 599, 10, 2, ["Up to 12 screens", "Role-based views"]),
      tier("Standard", 999, 14, 3, ["Up to 25 screens", "Filters + tables", "Permissions UI"]),
      tier("Premium", 1799, 21, "Unlimited", ["Up to 45 screens", "Reporting views", "Design system"]),
    ],
    addons: [addon("Print/export views", 149, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["dashboard", "internal", "ops", "field"],
    relatedServiceKey: "mobile_apps",
  }),
  mk({
    id: "marketplace-app", title: "Marketplace / two-sided app",
    category: "mobile_app_design", categoryName: "Mobile App Design",
    blurb: "Customer + provider flows for a marketplace app.",
    description: "Full UI for a two-sided marketplace: customer browsing/checkout flow and provider onboarding/order management. Includes ratings, messaging and payouts screens.",
    thumb: "mobile", rating: 4.8, reviews: 18,
    tiers: [
      tier("Basic", 999, 14, 2, ["Customer + provider core flows", "Up to 25 screens"]),
      tier("Standard", 1799, 21, 3, ["Up to 45 screens", "Onboarding + payouts UI"]),
      tier("Premium", 3299, 30, "Unlimited", ["Up to 80 screens", "Admin console UI", "Design system"]),
    ],
    addons: [addon("Admin web console UI", 499, 7)],
    faq: [FAQ_OWNERSHIP],
    tags: ["marketplace", "two-sided", "platform"],
    relatedServiceKey: "mobile_apps", intakeRequired: true,
  }),

  // ───────────────── LOGO & BRANDING ─────────────────
  mk({
    id: "logo-design", title: "Professional logo design",
    category: "logo_design", categoryName: "Logo & Branding",
    blurb: "A distinct logo with source files and color variants.",
    description: "A custom logo designed by a TAKATAK-vetted designer. Includes color, mono and reversed variants plus full editable source files. Payment is held by TAKATAK until you approve the final delivery.",
    thumb: "logo", rating: 4.8, reviews: 312,
    tiers: [
      tier("Basic", 79, 3, 2, ["1 logo concept", "PNG + SVG", "Color + black-and-white"]),
      tier("Standard", 159, 5, 3, ["3 logo concepts", "Full source files", "Color palette", "Social media kit"]),
      tier("Premium", 299, 7, "Unlimited", ["5 logo concepts", "Source files (AI/SVG/PDF)", "Brand guidelines PDF", "Stationery mockups"]),
    ],
    addons: [addon("Business card design", 49, 2), addon("Extra concept", 29, 2)],
    faq: [{ q: "Do I get the source files?", a: "Yes, Standard and Premium include editable source files." }, FAQ_OWNERSHIP],
    tags: ["logo", "brand", "identity", "design"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "brand-identity-kit", title: "Brand identity kit",
    category: "branding", categoryName: "Logo & Branding",
    blurb: "Logo, palette, type and a usage guide in one pack.",
    description: "A complete starter brand: logo, colors, typography pairing, tone-of-voice notes and a one-page usage guide. Built so your team and freelancers stay on-brand.",
    thumb: "branding", rating: 4.8, reviews: 96,
    tiers: [
      tier("Basic", 249, 7, 2, ["Logo (1 concept)", "Color palette", "Type pairing"]),
      tier("Standard", 499, 10, 3, ["Logo (3 concepts)", "Brand guidelines PDF", "Social templates"]),
      tier("Premium", 899, 14, "Unlimited", ["Full brand book", "Stationery mockups", "Pitch deck template"]),
    ],
    addons: [addon("Pitch deck (10 slides)", 199, 5)],
    faq: [FAQ_OWNERSHIP],
    tags: ["brand", "identity", "guidelines", "kit"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "business-card-design", title: "Business card design",
    category: "business_card_design", categoryName: "Logo & Branding",
    blurb: "Print-ready, on-brand business cards.",
    description: "A clean, print-ready business card design that matches your brand. Front + back, multiple variants and source files included.",
    thumb: "branding", rating: 4.9, reviews: 138,
    tiers: [
      tier("Basic", 49, 2, 2, ["1 concept", "Print-ready PDF"]),
      tier("Standard", 89, 3, 3, ["2 concepts", "Front + back", "Source files"]),
      tier("Premium", 149, 4, "Unlimited", ["3 concepts", "Spot-UV/foil mockups", "Print partner referral"]),
    ],
    addons: [addon("Letterhead + envelope", 79, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["business card", "print", "stationery"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "social-brand-kit", title: "Social media brand kit",
    category: "branding", categoryName: "Logo & Branding",
    blurb: "Consistent templates for every social channel.",
    description: "On-brand templates for Instagram, Facebook, LinkedIn and TikTok: profile assets, post templates, story templates and highlight covers.",
    thumb: "branding", rating: 4.7, reviews: 74,
    tiers: [
      tier("Basic", 129, 5, 2, ["Profile pic + cover", "5 post templates"]),
      tier("Standard", 249, 7, 3, ["3 platforms", "15 post templates", "Story templates"]),
      tier("Premium", 449, 10, "Unlimited", ["4 platforms", "30 templates", "Highlight covers", "Editable Canva file"]),
    ],
    addons: [addon("Extra 10 templates", 99, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["social", "templates", "brand", "canva"],
    relatedServiceKey: "social_media",
  }),

  // ───────────────── MARKETING ─────────────────
  mk({
    id: "online-ads-setup", title: "Online ads setup",
    category: "online_advertising", categoryName: "Marketing",
    blurb: "Get your first paid campaigns live, properly tracked.",
    description: "TAKATAK sets up tracking (GA4 + pixels), builds your ad accounts, structures campaigns and ships your first conversion-ready ads on Google or Meta.",
    thumb: "seo", rating: 4.7, reviews: 58,
    tiers: [
      tier("Basic", 249, 5, 1, ["1 platform", "Account + pixel setup", "1 campaign"]),
      tier("Standard", 499, 7, 2, ["2 platforms", "Conversion tracking", "2 campaigns + creatives"]),
      tier("Premium", 899, 10, 3, ["Full funnel setup", "Retargeting", "Reporting dashboard"]),
    ],
    addons: [addon("Extra campaign", 149, 3), addon("Ad creative pack (5)", 199, 4)],
    faq: [{ q: "Is ad spend included?", a: "No — you fund your own ad account directly. TAKATAK handles setup, creative and optimization." }],
    tags: ["ads", "advertising", "google ads", "meta", "facebook"],
    relatedServiceKey: "online_marketing", intakeRequired: true,
  }),
  mk({
    id: "google-ads-campaign", title: "Google Ads campaign",
    category: "online_advertising", categoryName: "Marketing",
    blurb: "Search + Performance Max campaigns that actually convert.",
    description: "A TAKATAK paid-search specialist plans, builds and optimizes Google Ads campaigns for your business — Search, Performance Max and remarketing.",
    thumb: "seo", rating: 4.8, reviews: 41,
    tiers: [
      tier("Basic", 299, 7, 1, ["1 Search campaign", "Keyword research", "Conversion tracking"]),
      tier("Standard", 599, 10, 2, ["Search + Performance Max", "Audience targeting", "First 14-day optimization"]),
      tier("Premium", 1099, 14, 3, ["Full account build", "Remarketing", "Reporting dashboard", "30-day optimization"]),
    ],
    addons: [addon("Landing page audit", 149, 3)],
    faq: [{ q: "Do you manage spend?", a: "TAKATAK monitors and optimizes. You set the budget and approve before scaling." }],
    tags: ["google ads", "search", "ppc", "performance max"],
    relatedServiceKey: "online_marketing",
  }),
  mk({
    id: "meta-ads", title: "Facebook & Instagram ads",
    category: "online_advertising", categoryName: "Marketing",
    blurb: "Creative-first ad campaigns on Meta.",
    description: "TAKATAK handles creative, targeting and Meta Ads Manager setup. Designed for lead-gen, ecommerce and local awareness.",
    thumb: "social", rating: 4.7, reviews: 63,
    tiers: [
      tier("Basic", 279, 7, 1, ["Pixel + events setup", "1 campaign", "3 ad creatives"]),
      tier("Standard", 549, 10, 2, ["2 campaigns", "6 creatives", "Lookalike audiences"]),
      tier("Premium", 999, 14, 3, ["Full funnel", "12 creatives", "Retargeting", "30-day optimization"]),
    ],
    addons: [addon("Extra 5 creatives", 199, 4)],
    faq: [{ q: "Do you write the copy?", a: "Yes — captions, hooks and primary text are written by the TAKATAK team." }],
    tags: ["facebook", "instagram", "meta", "ads"],
    relatedServiceKey: "social_media",
  }),
  mk({
    id: "email-marketing-setup", title: "Email marketing setup",
    category: "online_advertising", categoryName: "Marketing",
    blurb: "Klaviyo / Mailchimp setup with your first 3 flows.",
    description: "TAKATAK sets up your email tool, imports lists, designs branded templates and ships your first transactional and marketing flows.",
    thumb: "automation", rating: 4.8, reviews: 39,
    tiers: [
      tier("Basic", 199, 5, 1, ["Account setup", "1 template", "Welcome flow"]),
      tier("Standard", 399, 7, 2, ["3 templates", "Welcome + abandoned cart + win-back flows"]),
      tier("Premium", 749, 10, 3, ["5 templates", "5 flows", "Segmentation strategy", "Reporting"]),
    ],
    addons: [addon("List migration", 99, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["email", "klaviyo", "mailchimp", "marketing"],
    relatedServiceKey: "online_marketing",
  }),

  // ───────────────── SOCIAL MEDIA ─────────────────
  mk({
    id: "social-content-pack", title: "Social media content pack",
    category: "social_media_content", categoryName: "Social Media",
    blurb: "A month of on-brand posts, ready to publish.",
    description: "TAKATAK assigns a content creator to produce a full month of on-brand social media posts. You review and approve before anything goes live.",
    thumb: "social", rating: 4.8, reviews: 142,
    tiers: [
      tier("Basic", 199, 7, 1, ["12 posts/month", "Captions + hashtags", "1 platform"]),
      tier("Standard", 379, 10, 2, ["20 posts/month", "2 platforms", "Content calendar"]),
      tier("Premium", 699, 14, 3, ["30 posts/month", "3 platforms", "Reels scripts", "Monthly review call"]),
    ],
    addons: [addon("Add platform", 99, 2), addon("3 reels edited", 149, 5)],
    faq: [{ q: "Do you post for me?", a: "Standard and Premium include scheduling. Posts go live only after your approval." }],
    tags: ["social", "instagram", "facebook", "tiktok", "content"],
    relatedServiceKey: "social_media",
  }),
  mk({
    id: "monthly-posting", title: "Monthly social posting service",
    category: "social_media_content", categoryName: "Social Media",
    blurb: "Content + scheduling, every month, hands-off.",
    description: "A monthly retainer for social content creation and scheduling. TAKATAK plans, designs, captions and posts — you approve once a month.",
    thumb: "social", rating: 4.8, reviews: 67,
    tiers: [
      tier("Basic", 349, 30, 1, ["12 posts", "1 platform", "Scheduling"]),
      tier("Standard", 599, 30, 2, ["20 posts", "2 platforms", "Stories", "Hashtag strategy"]),
      tier("Premium", 999, 30, 3, ["30 posts", "3 platforms", "Reels", "Monthly report"]),
    ],
    addons: [addon("Community management", 199, 30)],
    faq: [FAQ_COMMS],
    tags: ["social", "monthly", "retainer", "posting"],
    relatedServiceKey: "social_media",
  }),
  mk({
    id: "reels-video-plan", title: "Reels & shorts content plan",
    category: "social_media_content", categoryName: "Social Media",
    blurb: "Short-video content built for Reels, TikTok and Shorts.",
    description: "A short-form video content plan: hooks, scripts, shot lists and edited reels. Designed for Reels, TikTok and YouTube Shorts.",
    thumb: "social", rating: 4.7, reviews: 38,
    tiers: [
      tier("Basic", 249, 7, 1, ["4 reel scripts", "1 platform"]),
      tier("Standard", 499, 10, 2, ["8 scripts", "4 edited reels", "Captions"]),
      tier("Premium", 899, 14, 3, ["12 scripts", "8 edited reels", "Hook frameworks"]),
    ],
    addons: [addon("Extra edited reel", 49, 2)],
    faq: [{ q: "Do you shoot the footage?", a: "You provide raw footage or stock. TAKATAK handles scripting and editing." }],
    tags: ["reels", "tiktok", "shorts", "video"],
    relatedServiceKey: "social_media",
  }),
  mk({
    id: "profile-optimization", title: "Social profile optimization",
    category: "social_media_content", categoryName: "Social Media",
    blurb: "Make your profiles work — bios, links, highlights, SEO.",
    description: "TAKATAK rewrites your bios, designs highlight covers, sets up link-in-bio and optimizes profile SEO across Instagram, Facebook, LinkedIn and TikTok.",
    thumb: "social", rating: 4.7, reviews: 52,
    tiers: [
      tier("Basic", 79, 3, 2, ["1 platform", "Bio + profile pic + cover"]),
      tier("Standard", 149, 5, 3, ["3 platforms", "Highlight covers", "Link-in-bio setup"]),
      tier("Premium", 249, 7, "Unlimited", ["4 platforms", "Profile SEO audit", "Pinned post strategy"]),
    ],
    addons: [],
    faq: [FAQ_OWNERSHIP],
    tags: ["profile", "optimization", "bio", "linkedin"],
    relatedServiceKey: "social_media",
  }),

  // ───────────────── SEO & LOCAL VISIBILITY ─────────────────
  mk({
    id: "local-seo-setup", title: "Local SEO setup",
    category: "seo_local_visibility", categoryName: "SEO & Local Visibility",
    blurb: "Rank locally on Google Maps and search.",
    description: "A TAKATAK specialist optimizes your Google Business Profile, fixes local citations, and improves your on-page SEO so customers in your area can find you.",
    thumb: "seo", rating: 4.7, reviews: 96,
    tiers: [
      tier("Basic", 149, 5, 1, ["Google Business setup", "5 local citations", "Keyword report"]),
      tier("Standard", 299, 10, 2, ["GBP optimization", "15 citations", "On-page SEO (3 pages)", "Monthly report"]),
      tier("Premium", 599, 14, 3, ["Full GBP overhaul", "30+ citations", "On-page SEO (6 pages)", "Competitor analysis", "60-day tracking"]),
    ],
    addons: [addon("Extra 10 citations", 59, 3), addon("Review response setup", 79, 2)],
    faq: [{ q: "How fast will I see results?", a: "Local rankings usually improve within 30–60 days." }, { q: "Do you guarantee #1?", a: "No one can. TAKATAK delivers proven best practices and tracks progress transparently." }],
    tags: ["seo", "local", "google", "maps", "visibility"],
    relatedServiceKey: "local_listings",
  }),
  mk({
    id: "qmaps-listing-setup", title: "QMAPS local listing setup",
    category: "seo_local_visibility", categoryName: "SEO & Local Visibility",
    blurb: "Launch on TAKATAK's QMAPS local visibility network.",
    description: "TAKATAK sets up your business on QMAPS — TAKATAK's local visibility network — and syncs your hours, services, photos and reviews across the major directories.",
    thumb: "seo", rating: 4.8, reviews: 47,
    tiers: [
      tier("Basic", 99, 3, 1, ["QMAPS profile setup", "Hours + services + photos"]),
      tier("Standard", 199, 5, 2, ["QMAPS profile", "Directory sync (10)", "Review collection link"]),
      tier("Premium", 349, 7, 3, ["QMAPS + GBP optimization", "Directory sync (25)", "Monthly QMAPS report"]),
    ],
    addons: [addon("Additional 10 directories", 49, 2)],
    faq: [{ q: "What is QMAPS?", a: "QMAPS is TAKATAK's local visibility platform — it syncs your business info across maps, search and directories from a single dashboard." }],
    tags: ["qmaps", "local", "listing", "directory"],
    relatedServiceKey: "local_listings",
  }),
  mk({
    id: "gbp-optimization", title: "Google Business Profile optimization",
    category: "seo_local_visibility", categoryName: "SEO & Local Visibility",
    blurb: "A full audit and overhaul of your Google Business Profile.",
    description: "TAKATAK rewrites your business description, fixes categories, adds services and products, uploads optimized photos and sets up a review response template.",
    thumb: "seo", rating: 4.8, reviews: 62,
    tiers: [
      tier("Basic", 89, 3, 1, ["Profile audit", "Category fixes", "Description rewrite"]),
      tier("Standard", 179, 5, 2, ["Full optimization", "Services + products", "Photo guidelines"]),
      tier("Premium", 349, 7, 3, ["Full optimization", "Q&A seeding", "Review template", "30-day tracking"]),
    ],
    addons: [addon("Geo-tagged photo pack", 79, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["google", "business", "profile", "gbp"],
    relatedServiceKey: "local_listings",
  }),
  mk({
    id: "citation-package", title: "Local citation listing package",
    category: "seo_local_visibility", categoryName: "SEO & Local Visibility",
    blurb: "Submit and clean your business across local directories.",
    description: "TAKATAK submits your business to high-quality local directories and cleans up duplicate or inconsistent listings. Builds the citation foundation Google looks for.",
    thumb: "seo", rating: 4.6, reviews: 34,
    tiers: [
      tier("Basic", 99, 5, 1, ["15 citations"]),
      tier("Standard", 199, 7, 2, ["30 citations", "Duplicate cleanup"]),
      tier("Premium", 349, 10, 3, ["60 citations", "Cleanup + tracking sheet"]),
    ],
    addons: [addon("Extra 10 citations", 49, 3)],
    faq: [],
    tags: ["citation", "directory", "yext", "nap"],
    relatedServiceKey: "local_listings",
  }),

  // ───────────────── LEAD GENERATION ─────────────────
  mk({
    id: "flexs-lead-campaign", title: "FLEXS lead campaign setup",
    category: "online_advertising", categoryName: "Lead Generation",
    blurb: "Plug into TAKATAK's FLEXS lead network.",
    description: "TAKATAK launches your business on FLEXS — our managed lead-generation engine. We set up the campaign, qualify the leads and route them straight to your CRM or inbox.",
    thumb: "ai", rating: 4.8, reviews: 29,
    tiers: [
      tier("Basic", 299, 7, 1, ["FLEXS campaign setup", "1 service area", "Email lead delivery"]),
      tier("Standard", 599, 10, 2, ["2 service areas", "Lead qualification", "CRM routing"]),
      tier("Premium", 1099, 14, 3, ["Multi-area", "Lead scoring", "Reporting dashboard", "30-day optimization"]),
    ],
    addons: [addon("Additional service area", 199, 3)],
    faq: [{ q: "What is FLEXS?", a: "FLEXS is TAKATAK's managed lead generation engine — pre-built campaigns, qualified leads, delivered to you." }],
    tags: ["flexs", "leads", "lead generation"],
    relatedServiceKey: "lead_generation", intakeRequired: true,
  }),
  mk({
    id: "lead-funnel", title: "Lead funnel setup",
    category: "online_advertising", categoryName: "Lead Generation",
    blurb: "Landing page + ads + email follow-up.",
    description: "A complete lead funnel: landing page, ad campaign, lead form, email follow-up sequence and reporting — built and tested by TAKATAK.",
    thumb: "automation", rating: 4.7, reviews: 36,
    tiers: [
      tier("Basic", 499, 10, 1, ["1 landing page", "1 ad campaign", "Welcome email"]),
      tier("Standard", 899, 14, 2, ["A/B landing page", "2 ad campaigns", "3-email follow-up"]),
      tier("Premium", 1599, 21, 3, ["Funnel + retargeting", "5-email nurture", "Reporting dashboard"]),
    ],
    addons: [addon("CRM integration", 199, 3)],
    faq: [{ q: "Is ad spend included?", a: "No — you fund the ad account. TAKATAK handles setup and optimization." }],
    tags: ["funnel", "leads", "landing page"],
    relatedServiceKey: "lead_generation",
  }),
  mk({
    id: "contact-form-automation", title: "Contact form automation",
    category: "automation_setup", categoryName: "Lead Generation",
    blurb: "Turn every form submission into an action.",
    description: "TAKATAK connects your website forms to email, CRM, SMS and Slack — with auto-replies, lead routing and basic spam protection.",
    thumb: "automation", rating: 4.8, reviews: 44,
    tiers: [
      tier("Basic", 149, 3, 1, ["1 form", "Email + auto-reply"]),
      tier("Standard", 279, 5, 2, ["Up to 3 forms", "CRM routing", "Slack/SMS alerts"]),
      tier("Premium", 499, 7, 3, ["Forms + spam protection", "Conditional routing", "Reporting"]),
    ],
    addons: [addon("Extra form", 49, 1)],
    faq: [FAQ_OWNERSHIP],
    tags: ["form", "contact", "automation", "lead"],
    relatedServiceKey: "lead_generation",
  }),
  mk({
    id: "crm-lead-routing", title: "CRM lead routing setup",
    category: "automation_setup", categoryName: "Lead Generation",
    blurb: "Right lead, right rep, right now.",
    description: "TAKATAK builds lead-routing rules in your CRM (HubSpot, Pipedrive, Zoho or Go High Level) so every new lead lands with the right rep instantly.",
    thumb: "automation", rating: 4.8, reviews: 22,
    tiers: [
      tier("Basic", 199, 5, 1, ["1 CRM", "Round-robin routing"]),
      tier("Standard", 379, 7, 2, ["1 CRM", "Rule-based routing", "Lead source tagging"]),
      tier("Premium", 699, 10, 3, ["Multi-source ingest", "Lead scoring", "Reporting dashboard"]),
    ],
    addons: [addon("Custom dashboard", 199, 5)],
    faq: [FAQ_OWNERSHIP],
    tags: ["crm", "routing", "lead", "hubspot", "pipedrive"],
    relatedServiceKey: "lead_generation",
  }),

  // ───────────────── DATA & ADMIN ─────────────────
  mk({
    id: "data-entry", title: "Reliable data entry & cleanup",
    category: "data_entry", categoryName: "Data & Admin",
    blurb: "Accurate entry, formatting and deduplication.",
    description: "A TAKATAK virtual assistant handles your data entry, list cleaning and formatting work with quality checks before delivery.",
    thumb: "data", rating: 4.9, reviews: 220,
    tiers: [
      tier("Basic", 49, 2, 1, ["Up to 200 entries", "CSV/Excel output"]),
      tier("Standard", 119, 4, 2, ["Up to 1,000 entries", "Multiple sources", "Deduplication"]),
      tier("Premium", 249, 6, 3, ["Up to 5,000 entries", "Validation rules", "Quality report"]),
    ],
    addons: [addon("Extra 500 entries", 39, 2), addon("24h rush", 49)],
    faq: [{ q: "Is my data confidential?", a: "Yes — every TAKATAK freelancer signs a confidentiality clause." }],
    tags: ["data", "entry", "spreadsheet", "excel"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "spreadsheet-cleanup", title: "Spreadsheet cleanup & formulas",
    category: "data_entry", categoryName: "Data & Admin",
    blurb: "Messy spreadsheet in, clean usable file out.",
    description: "TAKATAK cleans, normalizes and structures messy Excel or Google Sheets files — deduplication, formula fixes, pivot setup and validation.",
    thumb: "data", rating: 4.8, reviews: 56,
    tiers: [
      tier("Basic", 59, 2, 1, ["1 file", "Cleanup + dedupe"]),
      tier("Standard", 129, 3, 2, ["Up to 3 files", "Formulas + lookups", "Validation"]),
      tier("Premium", 249, 5, 3, ["Up to 5 files", "Pivots + dashboard", "Documentation"]),
    ],
    addons: [addon("Google Sheets automation", 99, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["spreadsheet", "excel", "cleanup", "formula"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "product-upload", title: "Ecommerce product upload",
    category: "data_entry", categoryName: "Data & Admin",
    blurb: "Bulk product upload, attributes and variants.",
    description: "TAKATAK uploads your products (titles, descriptions, attributes, variants and images) to Shopify, WooCommerce or other platforms — clean and ready to sell.",
    thumb: "ecommerce", rating: 4.8, reviews: 41,
    tiers: [
      tier("Basic", 79, 3, 1, ["Up to 25 products", "1 platform"]),
      tier("Standard", 179, 5, 2, ["Up to 100 products", "Variants + categories"]),
      tier("Premium", 349, 7, 3, ["Up to 300 products", "SEO fields", "Bulk import file"]),
    ],
    addons: [addon("Image background removal (50)", 79, 3)],
    faq: [],
    tags: ["product", "upload", "shopify", "ecommerce"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "menu-data-entry", title: "Restaurant menu data entry",
    category: "data_entry", categoryName: "Data & Admin",
    blurb: "Bulk menu upload to delivery apps and ordering systems.",
    description: "TAKATAK enters your menu items, modifiers and prices into your delivery platforms (UberEats, DoorDash, SkipTheDishes) or POS — accurately and fast.",
    thumb: "menu", rating: 4.7, reviews: 28,
    tiers: [
      tier("Basic", 89, 3, 1, ["Up to 40 items", "1 platform"]),
      tier("Standard", 179, 5, 2, ["Up to 100 items", "Modifiers", "2 platforms"]),
      tier("Premium", 349, 7, 3, ["Up to 250 items", "3 platforms", "Photo placement"]),
    ],
    addons: [addon("Extra platform", 79, 2)],
    faq: [],
    tags: ["menu", "ubereats", "doordash", "restaurant"],
    relatedServiceKey: "freelancer_marketplace",
  }),

  // ───────────────── DESIGN (PRINT / GRAPHIC) ─────────────────
  mk({
    id: "menu-design", title: "Restaurant menu design",
    category: "menu_design", categoryName: "Design",
    blurb: "Print and digital menus that match your brand.",
    description: "A TAKATAK designer creates a clean, on-brand menu for your restaurant or cafe. Print-ready PDF and digital QR menu included.",
    thumb: "menu", rating: 4.8, reviews: 64,
    tiers: [
      tier("Basic", 89, 3, 2, ["1-page menu", "Print-ready PDF"]),
      tier("Standard", 169, 5, 3, ["2-page menu", "Print + digital", "Editable source"]),
      tier("Premium", 299, 7, "Unlimited", ["Multi-section menu", "Seasonal variants", "QR menu", "Source files"]),
    ],
    addons: [addon("Translation (FR/EN)", 49, 2), addon("Photo retouching", 79, 3)],
    faq: [{ q: "Do you print?", a: "TAKATAK delivers print-ready files. You can print locally or we can recommend a partner." }],
    tags: ["menu", "restaurant", "food", "cafe"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "flyer-design", title: "Flyer design",
    category: "flyer_design", categoryName: "Design",
    blurb: "Eye-catching flyers for events, promos and openings.",
    description: "TAKATAK designs a one or two-sided flyer with strong hierarchy, on-brand visuals and print-ready files.",
    thumb: "flyer", rating: 4.8, reviews: 91,
    tiers: [
      tier("Basic", 49, 2, 2, ["Single-sided flyer", "Print + digital PDF"]),
      tier("Standard", 99, 3, 3, ["Double-sided", "Source files"]),
      tier("Premium", 179, 5, "Unlimited", ["3 concepts", "Source files", "Social variants"]),
    ],
    addons: [addon("Translation (FR/EN)", 29, 2)],
    faq: [FAQ_OWNERSHIP],
    tags: ["flyer", "print", "promo", "event"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "poster-design", title: "Poster design",
    category: "flyer_design", categoryName: "Design",
    blurb: "Print-ready posters for events, retail and venues.",
    description: "A TAKATAK designer creates a high-impact poster sized for print (A2/A3/B2) — perfect for retail, events or venues.",
    thumb: "flyer", rating: 4.7, reviews: 47,
    tiers: [
      tier("Basic", 79, 3, 2, ["1 poster", "Print-ready PDF"]),
      tier("Standard", 149, 5, 3, ["2 concepts", "Source files"]),
      tier("Premium", 249, 7, "Unlimited", ["3 concepts", "Source files", "Social adaptation"]),
    ],
    addons: [],
    faq: [FAQ_OWNERSHIP],
    tags: ["poster", "print", "event"],
    relatedServiceKey: "freelancer_marketplace",
  }),
  mk({
    id: "digital-ad-banner", title: "Digital ad banner set",
    category: "flyer_design", categoryName: "Design",
    blurb: "On-brand ad banners in all the right sizes.",
    description: "TAKATAK designs a set of digital ad banners for Google Ads, Meta and display campaigns in all required sizes.",
    thumb: "flyer", rating: 4.8, reviews: 35,
    tiers: [
      tier("Basic", 79, 3, 2, ["3 sizes", "Static banners"]),
      tier("Standard", 149, 5, 3, ["6 sizes", "Animated GIF version"]),
      tier("Premium", 279, 7, "Unlimited", ["All standard sizes", "Animated HTML5", "Source files"]),
    ],
    addons: [addon("Extra 3 sizes", 49, 2)],
    faq: [],
    tags: ["banner", "ad", "display", "google ads"],
    relatedServiceKey: "online_marketing",
  }),

  // ───────────────── AUTOMATION & AI ─────────────────
  mk({
    id: "ai-chatbot-setup", title: "AI chatbot setup",
    category: "ai_tool_setup", categoryName: "Automation & AI",
    blurb: "A trained chatbot that answers FAQs and captures leads.",
    description: "TAKATAK builds and trains an AI chatbot on your website content and FAQ. Captures leads, answers common questions and escalates to a human when needed.",
    thumb: "ai", rating: 4.8, reviews: 38,
    tiers: [
      tier("Basic", 249, 5, 1, ["Website chatbot", "Trained on up to 20 FAQs"]),
      tier("Standard", 499, 7, 2, ["Site + WhatsApp", "Up to 50 FAQs", "Lead capture"]),
      tier("Premium", 899, 10, 3, ["Site + WhatsApp + Messenger", "100+ FAQs", "CRM handoff"]),
    ],
    addons: [addon("Extra channel", 149, 3)],
    faq: [{ q: "Which model?", a: "TAKATAK selects the best model for your case — typically GPT, Claude or a managed alternative." }],
    tags: ["ai", "chatbot", "assistant", "support"],
    relatedServiceKey: "ai_business_tools", intakeRequired: true,
  }),
  mk({
    id: "automation-setup", title: "Business automation setup",
    category: "automation_setup", categoryName: "Automation & AI",
    blurb: "Connect your tools and stop doing repetitive tasks.",
    description: "TAKATAK builds and tests automations between your CRM, email, calendar and tools so manual data entry disappears.",
    thumb: "automation", rating: 4.7, reviews: 41,
    tiers: [
      tier("Basic", 249, 5, 1, ["1 automation flow", "2 integrated tools"]),
      tier("Standard", 499, 10, 2, ["3 flows", "Up to 5 tools", "Error notifications"]),
      tier("Premium", 899, 14, 3, ["6 flows", "Unlimited tools", "Monitoring + 30-day support"]),
    ],
    addons: [addon("Extra flow", 99, 3), addon("Custom dashboard", 199, 5)],
    faq: [{ q: "Which tools?", a: "Zapier, Make, n8n, native APIs — TAKATAK picks the right stack." }],
    tags: ["automation", "zapier", "make", "workflow"],
    relatedServiceKey: "ai_business_tools",
  }),
  mk({
    id: "workflow-automation", title: "Internal workflow automation",
    category: "automation_setup", categoryName: "Automation & AI",
    blurb: "Replace manual workflows with reliable automations.",
    description: "TAKATAK maps your team's current workflow, identifies bottlenecks and ships automations across approvals, hand-offs, document generation and reporting.",
    thumb: "automation", rating: 4.7, reviews: 23,
    tiers: [
      tier("Basic", 399, 7, 1, ["1 workflow mapped + automated"]),
      tier("Standard", 799, 12, 2, ["3 workflows", "Documentation"]),
      tier("Premium", 1399, 18, 3, ["6 workflows", "Training session", "30-day support"]),
    ],
    addons: [],
    faq: [FAQ_OWNERSHIP],
    tags: ["workflow", "automation", "ops"],
    relatedServiceKey: "ai_business_tools",
  }),
  mk({
    id: "ai-intake-form", title: "AI intake form setup",
    category: "ai_tool_setup", categoryName: "Automation & AI",
    blurb: "A smart intake that briefs your team automatically.",
    description: "TAKATAK builds an AI-assisted intake form: clients answer plain questions, AI structures the answers into a clean brief and routes it to the right channel.",
    thumb: "ai", rating: 4.8, reviews: 17,
    tiers: [
      tier("Basic", 199, 5, 1, ["1 intake form", "Email summary"]),
      tier("Standard", 379, 7, 2, ["Up to 3 forms", "CRM routing", "Brief generation"]),
      tier("Premium", 699, 10, 3, ["Multi-form", "Branching logic", "Reporting"]),
    ],
    addons: [addon("Extra intake form", 99, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["intake", "form", "ai", "brief"],
    relatedServiceKey: "ai_business_tools",
  }),

  // ───────────────── VOIP ─────────────────
  mk({
    id: "voip-business-phone", title: "Business phone setup",
    category: "automation_setup", categoryName: "VoIP",
    blurb: "Cloud phone number, voicemail and team routing.",
    description: "TAKATAK sets up your business phone line: cloud number, voicemail, after-hours greeting and team routing — all manageable from a web dashboard.",
    thumb: "automation", rating: 4.7, reviews: 26,
    tiers: [
      tier("Basic", 99, 3, 1, ["1 number", "Voicemail + greeting"]),
      tier("Standard", 199, 5, 2, ["1 number", "Team routing", "Business hours"]),
      tier("Premium", 349, 7, 3, ["Multi-number", "IVR menu", "Voicemail-to-email"]),
    ],
    addons: [addon("Number porting", 79, 5)],
    faq: [{ q: "Do I keep my current number?", a: "Yes — TAKATAK handles porting if your carrier allows it." }],
    tags: ["voip", "phone", "voice"],
    relatedServiceKey: "voip_phone",
  }),
  mk({
    id: "voip-call-routing", title: "Call routing & IVR setup",
    category: "automation_setup", categoryName: "VoIP",
    blurb: "Send every call to the right person, every time.",
    description: "TAKATAK designs and builds your IVR menu and call routing flows — by time of day, language, department or skill.",
    thumb: "automation", rating: 4.7, reviews: 14,
    tiers: [
      tier("Basic", 149, 3, 1, ["IVR (3 options)", "Business hours"]),
      tier("Standard", 279, 5, 2, ["IVR + skill routing", "Voicemail rules"]),
      tier("Premium", 499, 7, 3, ["Multi-language IVR", "Overflow routing", "Reporting"]),
    ],
    addons: [],
    faq: [],
    tags: ["voip", "ivr", "routing", "call"],
    relatedServiceKey: "voip_phone",
  }),
  mk({
    id: "voip-sms-voice-workflow", title: "SMS & voice workflow setup",
    category: "automation_setup", categoryName: "VoIP",
    blurb: "Automated SMS and voice flows for bookings and reminders.",
    description: "TAKATAK builds automated SMS and voice workflows: booking confirmations, reminders, review requests and missed-call text-back.",
    thumb: "automation", rating: 4.8, reviews: 19,
    tiers: [
      tier("Basic", 179, 5, 1, ["Missed-call text-back", "1 SMS template"]),
      tier("Standard", 349, 7, 2, ["3 SMS flows", "Booking reminders"]),
      tier("Premium", 599, 10, 3, ["5 flows", "Two-way SMS", "Reporting"]),
    ],
    addons: [],
    faq: [],
    tags: ["sms", "voice", "workflow", "voip"],
    relatedServiceKey: "voip_phone",
  }),

  // ───────────────── CONTENT WRITING (extra) ─────────────────
  mk({
    id: "website-copywriting", title: "Website copywriting",
    category: "content_writing", categoryName: "Content Writing",
    blurb: "Clear, conversion-focused website copy.",
    description: "A TAKATAK copywriter researches your business and writes clean, persuasive copy for your home, about, services and contact pages.",
    thumb: "website", rating: 4.8, reviews: 53,
    tiers: [
      tier("Basic", 149, 4, 2, ["Up to 3 pages", "SEO-aware"]),
      tier("Standard", 299, 6, 3, ["Up to 5 pages", "Headlines + meta"]),
      tier("Premium", 549, 9, "Unlimited", ["Up to 8 pages", "Tone of voice doc", "Blog outline"]),
    ],
    addons: [addon("Translation (FR/EN)", 99, 3)],
    faq: [FAQ_OWNERSHIP],
    tags: ["copywriting", "website", "content"],
    relatedServiceKey: "freelancer_marketplace",
  }),
];

export function getPackage(id: string): MarketplacePackageDetail | undefined {
  return MARKETPLACE_PACKAGES.find((p) => p.id === id || p.slug === id);
}

export function searchPackages(q: string, categorySlug?: string): MarketplacePackageDetail[] {
  const query = q.trim().toLowerCase();
  return MARKETPLACE_PACKAGES.filter((p) => {
    if (categorySlug && p.category !== categorySlug) return false;
    if (!query) return true;
    if (p.title.toLowerCase().includes(query)) return true;
    if (p.blurb.toLowerCase().includes(query)) return true;
    if (p.categoryName.toLowerCase().includes(query)) return true;
    return p.tags.some((k) => k.includes(query) || query.includes(k));
  });
}

export function formatStartingPrice(p: MarketplacePackageDetail): string {
  const cents = Math.min(...p.tiers.map((x) => x.priceCents));
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function shortestDelivery(p: MarketplacePackageDetail): number {
  return Math.min(...p.tiers.map((x) => x.deliveryDays));
}

export const PACKAGE_CATEGORIES_DISPLAY: { slug: string; name: string }[] = Array.from(
  new Map(MARKETPLACE_PACKAGES.map((p) => [p.category, p.categoryName])).entries(),
).map(([slug, name]) => ({ slug, name }));

export function getPackagesByCategory(slug: string): MarketplacePackageDetail[] {
  return MARKETPLACE_PACKAGES.filter((p) => p.category === slug);
}

/** Suggest packages related to the given one: same category first, then same
 *  related service key. Excludes the original. */
export function relatedPackages(pkg: MarketplacePackageDetail, limit = 3): MarketplacePackageDetail[] {
  const sameCat = MARKETPLACE_PACKAGES.filter((p) => p.id !== pkg.id && p.category === pkg.category);
  const sameService = MARKETPLACE_PACKAGES.filter(
    (p) => p.id !== pkg.id && p.category !== pkg.category && p.relatedServiceKey === pkg.relatedServiceKey,
  );
  const seen = new Set<string>();
  return [...sameCat, ...sameService].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, limit);
}
