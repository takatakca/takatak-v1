export type MarketplaceThumbnail =
  | "website"
  | "mobile"
  | "logo"
  | "branding"
  | "social"
  | "seo"
  | "data"
  | "menu"
  | "flyer"
  | "ecommerce"
  | "automation"
  | "ai";

export interface MarketplaceCategory {
  slug: string;
  name: string;
}

export interface MarketplaceTier {
  name: "Basic" | "Standard" | "Premium";
  priceCents: number;
  deliveryDays: number;
  revisions: number | "Unlimited";
  includes: string[];
}

export interface MarketplaceAddon {
  label: string;
  priceCents: number;
  deliveryDays?: number;
}

export interface MarketplaceFaq {
  q: string;
  a: string;
}

export interface MarketplacePackage {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  blurb: string;
  description: string;
  thumb: MarketplaceThumbnail;
  rating: number;
  reviews: number;
  tiers: MarketplaceTier[];
  addons: MarketplaceAddon[];
  faq: MarketplaceFaq[];
  deliverables: string[];
  tags: string[];
  intakeRequired: boolean;
  quoteAvailable: boolean;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] =
  [
    {
      slug: "logo_design",
      name: "Logo Design",
    },
    {
      slug: "website_design",
      name: "Website Design",
    },
    {
      slug: "mobile_app_design",
      name: "Mobile App Design",
    },
    {
      slug: "branding",
      name: "Branding",
    },
    {
      slug: "business_card_design",
      name: "Business Card Design",
    },
    {
      slug: "page_layout",
      name: "Page Layout",
    },
    {
      slug: "data_entry",
      name: "Data Entry",
    },
    {
      slug: "virtual_assistance",
      name: "Virtual Assistance",
    },
    {
      slug: "social_media_content",
      name: "Social Media Content",
    },
    {
      slug: "online_advertising",
      name: "Online Advertising",
    },
    {
      slug: "seo_local_visibility",
      name: "SEO & Local Visibility",
    },
    {
      slug: "automation_setup",
      name: "Automation Setup",
    },
    {
      slug: "ai_tool_setup",
      name: "AI Tool Setup",
    },
    {
      slug: "content_writing",
      name: "Content Writing",
    },
    {
      slug: "menu_design",
      name: "Menu Design",
    },
    {
      slug: "flyer_design",
      name: "Flyer Design",
    },
    {
      slug: "ecommerce_setup",
      name: "Ecommerce Setup",
    },
    {
      slug: "lead_generation",
      name: "Lead Generation",
    },
  ];

const ownershipFaq: MarketplaceFaq = {
  q: "Who owns the final files?",
  a: "You own the approved deliverables, source files, and transferred accounts after completion.",
};

const revisionsFaq: MarketplaceFaq = {
  q: "What happens when I need changes?",
  a: "Request revisions from the TAKATAK project workspace during the active project.",
};

const communicationFaq: MarketplaceFaq = {
  q: "How is communication handled?",
  a: "Files, messages, milestones, revisions, and approvals remain organized inside the TAKATAK workspace.",
};

function tier(
  name: MarketplaceTier["name"],
  price: number,
  deliveryDays: number,
  revisions: MarketplaceTier["revisions"],
  includes: string[],
): MarketplaceTier {
  return {
    name,
    priceCents: price * 100,
    deliveryDays,
    revisions,
    includes,
  };
}

function addon(
  label: string,
  price: number,
  deliveryDays?: number,
): MarketplaceAddon {
  return {
    label,
    priceCents: price * 100,
    deliveryDays,
  };
}

function standardTiers(
  startingPrice: number,
  includes: string[],
  deliveryDays = 5,
): MarketplaceTier[] {
  return [
    tier(
      "Basic",
      startingPrice,
      deliveryDays,
      2,
      includes.slice(0, 3),
    ),
    tier(
      "Standard",
      Math.round(startingPrice * 1.75),
      deliveryDays + 2,
      3,
      includes.slice(0, 5),
    ),
    tier(
      "Premium",
      Math.round(startingPrice * 3),
      deliveryDays + 5,
      "Unlimited",
      includes,
    ),
  ];
}

function pkg(
  input: Omit<
    MarketplacePackage,
    "faq" | "addons"
  > & {
    faq?: MarketplaceFaq[];
    addons?: MarketplaceAddon[];
  },
): MarketplacePackage {
  return {
    ...input,
    faq: input.faq ?? [
      ownershipFaq,
      communicationFaq,
      revisionsFaq,
    ],
    addons: input.addons ?? [
      addon("Priority delivery", 49, -1),
      addon("Additional revision", 29),
      addon("Extended support", 79),
    ],
  };
}

export const MARKETPLACE_PACKAGES: MarketplacePackage[] =
  [
    pkg({
      id: "logo-design",
      title: "Professional logo design",
      category: "logo_design",
      categoryName: "Logo & Branding",
      blurb:
        "A distinct logo with source files and colour variants.",
      description:
        "A professional logo package developed around your business, target audience, market, and intended use.",
      thumb: "logo",
      rating: 4.8,
      reviews: 312,
      tiers: [
        tier("Basic", 79, 3, 2, [
          "One logo concept",
          "PNG and JPG files",
          "Transparent background",
        ]),
        tier("Standard", 149, 5, 3, [
          "Three logo concepts",
          "Colour variants",
          "Transparent files",
          "Vector source files",
          "Social profile versions",
        ]),
        tier(
          "Premium",
          299,
          7,
          "Unlimited",
          [
            "Five logo concepts",
            "Complete source files",
            "Brand colour palette",
            "Typography selection",
            "Social profile versions",
            "Mini brand guide",
          ],
        ),
      ],
      addons: [
        addon("Business card design", 49, 2),
        addon("Social media kit", 59, 2),
        addon("Brand guide", 99, 3),
      ],
      deliverables: [
        "Primary logo",
        "Colour variants",
        "Transparent files",
        "Source files",
        "Social profile files",
        "Commercial ownership",
      ],
      tags: [
        "logo",
        "branding",
        "identity",
        "graphic design",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "website-starter",
      title: "Starter business website",
      category: "website_design",
      categoryName: "Website Development",
      blurb:
        "A clean, responsive 5-page website for your business.",
      description:
        "A professional responsive website prepared for mobile devices, search engines, lead capture, and customer inquiries.",
      thumb: "website",
      rating: 4.9,
      reviews: 184,
      tiers: [
        tier("Basic", 299, 7, 2, [
          "Up to 3 pages",
          "Mobile responsive",
          "Contact form",
          "Basic SEO",
        ]),
        tier("Standard", 549, 10, 3, [
          "Up to 5 pages",
          "Custom design",
          "Contact form",
          "Blog or news section",
          "Analytics setup",
        ]),
        tier(
          "Premium",
          999,
          14,
          "Unlimited",
          [
            "Up to 8 pages",
            "Advanced custom design",
            "Booking or quote form",
            "Speed optimization",
            "Analytics setup",
            "One month support",
          ],
        ),
      ],
      addons: [
        addon("Additional page", 49, 1),
        addon("French and English setup", 129, 3),
        addon("Logo design", 99, 3),
      ],
      deliverables: [
        "Responsive pages",
        "Contact form",
        "Basic SEO",
        "Analytics readiness",
        "Launch support",
        "Source access",
      ],
      tags: [
        "website",
        "wordpress",
        "business",
        "web development",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "website-restaurant",
      title: "Restaurant website",
      category: "website_design",
      categoryName: "Website Development",
      blurb:
        "Menu, hours, reservations and Google Maps — all in one site.",
      description:
        "A restaurant-focused website containing your menu, location, hours, ordering links, reservations, and customer information.",
      thumb: "website",
      rating: 4.8,
      reviews: 72,
      tiers: [
        tier("Basic", 349, 7, 2, [
          "Menu page",
          "Hours and address",
          "Google Maps",
          "Mobile layout",
        ]),
        tier("Standard", 649, 10, 3, [
          "HTML and PDF menu",
          "Reservation link",
          "Photo gallery",
          "Google Maps",
          "Basic SEO",
        ]),
        tier(
          "Premium",
          1199,
          14,
          "Unlimited",
          [
            "Online ordering integration",
            "French and English",
            "Google Business links",
            "Photo gallery",
            "Speed optimization",
            "Launch support",
          ],
        ),
      ],
      addons: [
        addon("Online ordering setup", 199, 5),
        addon("QR menu", 49, 1),
        addon("Photo retouching", 79, 3),
      ],
      deliverables: [
        "Restaurant pages",
        "Menu section",
        "Location information",
        "Reservation integration",
        "Mobile layout",
        "Launch support",
      ],
      tags: [
        "restaurant",
        "food",
        "menu",
        "reservation",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "landing-page",
      title: "High-conversion landing page",
      category: "website_design",
      categoryName: "Website Development",
      blurb:
        "A single focused page built to convert leads.",
      description:
        "A focused campaign landing page with professional messaging, social proof, lead capture, and tracking readiness.",
      thumb: "website",
      rating: 4.9,
      reviews: 121,
      tiers: standardTiers(
        199,
        [
          "Responsive landing page",
          "Lead form",
          "Call-to-action sections",
          "Social proof section",
          "Analytics setup",
          "Speed optimization",
        ],
        5,
      ),
      deliverables: [
        "Landing page",
        "Lead form",
        "Mobile layout",
        "Analytics readiness",
        "Campaign links",
        "Launch support",
      ],
      tags: [
        "landing page",
        "lead generation",
        "campaign",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "booking-website",
      title: "Booking and appointments website",
      category: "website_design",
      categoryName: "Website Development",
      blurb:
        "Let customers book services online, 24/7.",
      description:
        "A service-business website with a booking calendar, appointment flow, notifications, and optional online payments.",
      thumb: "website",
      rating: 4.7,
      reviews: 54,
      tiers: standardTiers(
        399,
        [
          "Booking calendar",
          "Service pages",
          "Customer form",
          "Email confirmations",
          "Online payment option",
          "Mobile layout",
        ],
        7,
      ),
      deliverables: [
        "Booking calendar",
        "Service pages",
        "Email notifications",
        "Mobile interface",
        "Payment readiness",
        "Launch support",
      ],
      tags: [
        "booking",
        "appointments",
        "calendar",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "website-redesign",
      title: "Website redesign and speed-up",
      category: "website_design",
      categoryName: "Website Development",
      blurb:
        "Modernize your existing site and improve page speed.",
      description:
        "A structured redesign preserving important content and URLs while improving layout, mobile usability, and performance.",
      thumb: "website",
      rating: 4.8,
      reviews: 67,
      tiers: standardTiers(
        449,
        [
          "Website audit",
          "Page redesign",
          "Mobile improvements",
          "Speed optimization",
          "SEO preservation",
          "Launch support",
        ],
        10,
      ),
      deliverables: [
        "Website audit",
        "Updated design",
        "Mobile improvements",
        "Speed optimization",
        "Migration support",
        "Launch review",
      ],
      tags: [
        "website redesign",
        "speed",
        "modernize",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "online-ads-setup",
      title: "Online ads setup",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Get your first paid campaigns live, properly tracked.",
      description:
        "Advertising account review, campaign setup, audience structure, and conversion tracking preparation.",
      thumb: "seo",
      rating: 4.7,
      reviews: 58,
      tiers: standardTiers(
        249,
        [
          "Campaign setup",
          "Audience configuration",
          "Tracking review",
          "Creative placement",
          "Conversion configuration",
          "Launch checklist",
        ],
        5,
      ),
      deliverables: [
        "Campaign structure",
        "Audience configuration",
        "Tracking review",
        "Launch checklist",
        "Account notes",
        "Optimization plan",
      ],
      tags: [
        "advertising",
        "online ads",
        "campaign",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "google-ads-campaign",
      title: "Google Ads campaign",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Search and Performance Max campaigns that convert.",
      description:
        "A Google Ads campaign prepared with keyword structure, audiences, ads, and conversion tracking.",
      thumb: "seo",
      rating: 4.8,
      reviews: 41,
      tiers: standardTiers(
        299,
        [
          "Campaign structure",
          "Keyword research",
          "Ad groups",
          "Ad copy",
          "Conversion tracking",
          "Launch review",
        ],
        7,
      ),
      deliverables: [
        "Keyword structure",
        "Campaign setup",
        "Ad copy",
        "Tracking review",
        "Launch notes",
        "Optimization plan",
      ],
      tags: [
        "google ads",
        "paid search",
        "performance max",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "meta-ads",
      title: "Facebook and Instagram ads",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Creative-first advertising campaigns on Meta.",
      description:
        "Meta campaign configuration for Facebook and Instagram with audiences, placements, creative structure, and tracking.",
      thumb: "social",
      rating: 4.7,
      reviews: 63,
      tiers: standardTiers(
        279,
        [
          "Campaign setup",
          "Audience targeting",
          "Placement setup",
          "Creative structure",
          "Tracking review",
          "Launch checklist",
        ],
        7,
      ),
      deliverables: [
        "Campaign setup",
        "Audience targeting",
        "Placement setup",
        "Tracking review",
        "Launch support",
        "Optimization notes",
      ],
      tags: [
        "facebook ads",
        "instagram ads",
        "meta",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "tiktok-ads",
      title: "TikTok advertising setup",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Short-form advertising campaigns built for TikTok.",
      description:
        "TikTok advertising setup with audience targeting, campaign structure, pixel review, and launch guidance.",
      thumb: "social",
      rating: 4.6,
      reviews: 29,
      tiers: standardTiers(
        279,
        [
          "Campaign setup",
          "Audience targeting",
          "Pixel review",
          "Creative guidance",
          "Placement configuration",
          "Launch support",
        ],
        7,
      ),
      deliverables: [
        "Campaign setup",
        "Audience targeting",
        "Pixel review",
        "Creative guidance",
        "Launch checklist",
        "Optimization notes",
      ],
      tags: [
        "tiktok ads",
        "video advertising",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "retargeting-campaign",
      title: "Retargeting campaign",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Reconnect with visitors who did not convert.",
      description:
        "A retargeting campaign for website visitors, customer lists, and engaged audiences.",
      thumb: "seo",
      rating: 4.8,
      reviews: 33,
      tiers: standardTiers(
        229,
        [
          "Audience setup",
          "Tracking review",
          "Campaign configuration",
          "Creative placements",
          "Exclusion rules",
          "Launch support",
        ],
        5,
      ),
      deliverables: [
        "Audience setup",
        "Campaign configuration",
        "Tracking review",
        "Exclusion rules",
        "Launch notes",
        "Optimization plan",
      ],
      tags: [
        "retargeting",
        "remarketing",
        "advertising",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "advertising-audit",
      title: "Advertising audit and optimization",
      category: "online_advertising",
      categoryName: "Marketing",
      blurb:
        "Find wasted budget and improve campaign structure.",
      description:
        "A structured advertising account review covering campaigns, audiences, tracking, creative performance, and budget allocation.",
      thumb: "seo",
      rating: 4.9,
      reviews: 44,
      tiers: standardTiers(
        199,
        [
          "Account audit",
          "Tracking review",
          "Budget review",
          "Audience review",
          "Issue list",
          "Optimization plan",
        ],
        4,
      ),
      deliverables: [
        "Account audit",
        "Performance review",
        "Tracking review",
        "Issue list",
        "Recommendations",
        "Optimization plan",
      ],
      tags: [
        "ads audit",
        "campaign audit",
        "optimization",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "social-content-pack",
      title: "Social media content pack",
      category: "social_media_content",
      categoryName: "Social Media",
      blurb:
        "A month of on-brand posts, ready to publish.",
      description:
        "A branded social media content package containing graphics, captions, hashtags, and a suggested publishing calendar.",
      thumb: "social",
      rating: 4.8,
      reviews: 142,
      tiers: standardTiers(
        199,
        [
          "Social graphics",
          "Captions",
          "Hashtag suggestions",
          "Content calendar",
          "Platform adaptations",
          "Revision round",
        ],
        7,
      ),
      deliverables: [
        "Social graphics",
        "Captions",
        "Hashtags",
        "Content calendar",
        "Platform formats",
        "Revision round",
      ],
      tags: [
        "social media",
        "content",
        "posts",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "monthly-social-posting",
      title: "Monthly social posting service",
      category: "social_media_content",
      categoryName: "Social Media",
      blurb:
        "Content and scheduling every month, hands-off.",
      description:
        "Ongoing monthly content preparation, approvals, scheduling, and performance organization.",
      thumb: "social",
      rating: 4.8,
      reviews: 67,
      tiers: standardTiers(
        349,
        [
          "Monthly content",
          "Captions",
          "Scheduling",
          "Approval workflow",
          "Platform adaptations",
          "Performance summary",
        ],
        30,
      ),
      deliverables: [
        "Monthly content",
        "Captions",
        "Scheduling",
        "Approval workflow",
        "Platform adaptations",
        "Performance summary",
      ],
      tags: [
        "social posting",
        "monthly content",
        "scheduling",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "reels-shorts-plan",
      title: "Reels and shorts content plan",
      category: "social_media_content",
      categoryName: "Social Media",
      blurb:
        "Short-video content prepared for Reels, TikTok and Shorts.",
      description:
        "A short-form video plan containing concepts, scripts, hooks, shot lists, and publishing guidance.",
      thumb: "social",
      rating: 4.7,
      reviews: 38,
      tiers: standardTiers(
        249,
        [
          "Video concepts",
          "Hooks",
          "Scripts",
          "Shot lists",
          "Caption suggestions",
          "Publishing plan",
        ],
        7,
      ),
      deliverables: [
        "Video concepts",
        "Hooks",
        "Scripts",
        "Shot lists",
        "Captions",
        "Publishing plan",
      ],
      tags: [
        "reels",
        "shorts",
        "tiktok",
        "video",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "social-strategy",
      title: "Social media strategy",
      category: "social_media_content",
      categoryName: "Social Media",
      blurb:
        "A practical channel, content, and growth plan.",
      description:
        "A social media strategy based on your company, customers, channels, content capacity, and business goals.",
      thumb: "social",
      rating: 4.9,
      reviews: 51,
      tiers: standardTiers(
        179,
        [
          "Channel review",
          "Audience definition",
          "Content pillars",
          "Posting cadence",
          "Growth recommendations",
          "Measurement plan",
        ],
        5,
      ),
      deliverables: [
        "Channel review",
        "Audience definition",
        "Content pillars",
        "Posting cadence",
        "Growth plan",
        "Measurement plan",
      ],
      tags: [
        "social strategy",
        "content plan",
        "growth",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "mobile-app-prototype",
      title: "Mobile app UI prototype",
      category: "mobile_app_design",
      categoryName: "Mobile App Design",
      blurb:
        "A clickable prototype of your application idea.",
      description:
        "A mobile application interface and clickable prototype prepared for validation, presentation, or developer handoff.",
      thumb: "mobile",
      rating: 4.8,
      reviews: 46,
      tiers: standardTiers(
        299,
        [
          "Application screens",
          "Clickable prototype",
          "Mobile design system",
          "User flow",
          "Developer notes",
          "Source design file",
        ],
        7,
      ),
      deliverables: [
        "Application screens",
        "Clickable prototype",
        "User flow",
        "Design system",
        "Developer notes",
        "Source files",
      ],
      tags: [
        "mobile app",
        "prototype",
        "figma",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "brand-identity-kit",
      title: "Complete brand identity kit",
      category: "branding",
      categoryName: "Branding",
      blurb:
        "Logo, colours, typography, and usage guidelines.",
      description:
        "A complete brand identity system designed for consistent use across digital and printed material.",
      thumb: "branding",
      rating: 4.9,
      reviews: 96,
      tiers: standardTiers(
        249,
        [
          "Primary logo",
          "Logo variants",
          "Colour palette",
          "Typography system",
          "Brand patterns",
          "Usage guide",
        ],
        7,
      ),
      deliverables: [
        "Primary logo",
        "Logo variants",
        "Colour palette",
        "Typography",
        "Brand elements",
        "Usage guide",
      ],
      tags: [
        "branding",
        "identity",
        "brand kit",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "business-card-design",
      title: "Professional business card design",
      category: "business_card_design",
      categoryName: "Graphics & Design",
      blurb:
        "A clean print-ready business card aligned with your brand.",
      description:
        "A professional business card prepared for print with correct dimensions, bleed, and export formats.",
      thumb: "branding",
      rating: 4.8,
      reviews: 89,
      tiers: standardTiers(
        49,
        [
          "Front and back design",
          "Print-ready PDF",
          "Bleed settings",
          "Editable source",
          "Digital version",
          "Revision round",
        ],
        3,
      ),
      deliverables: [
        "Front design",
        "Back design",
        "Print-ready PDF",
        "Editable source",
        "Digital version",
        "Revision",
      ],
      tags: [
        "business card",
        "print design",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "page-layout",
      title: "Professional page layout",
      category: "page_layout",
      categoryName: "Graphics & Design",
      blurb:
        "Clean layout for reports, brochures, guides, and documents.",
      description:
        "Professional layout and formatting for multi-page business documents.",
      thumb: "branding",
      rating: 4.8,
      reviews: 61,
      tiers: standardTiers(
        79,
        [
          "Page layout",
          "Typography",
          "Image placement",
          "Print-ready file",
          "Digital PDF",
          "Editable source",
        ],
        4,
      ),
      deliverables: [
        "Page layout",
        "Typography system",
        "Image placement",
        "Print-ready PDF",
        "Digital PDF",
        "Editable source",
      ],
      tags: [
        "layout",
        "brochure",
        "document design",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "data-entry",
      title: "Accurate data entry and cleanup",
      category: "data_entry",
      categoryName: "Data",
      blurb:
        "Spreadsheet entry, formatting, and structured cleanup.",
      description:
        "Accurate data entry and spreadsheet organization for business records, inventory, customer information, or operations.",
      thumb: "data",
      rating: 4.9,
      reviews: 410,
      tiers: standardTiers(
        20,
        [
          "Data entry",
          "Formatting",
          "Duplicate review",
          "Column organization",
          "Quality check",
          "Final spreadsheet",
        ],
        2,
      ),
      deliverables: [
        "Data entry",
        "Formatting",
        "Duplicate review",
        "Column organization",
        "Quality check",
        "Final export",
      ],
      tags: [
        "data entry",
        "spreadsheet",
        "cleanup",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "virtual-assistant",
      title: "Virtual assistant support",
      category: "virtual_assistance",
      categoryName: "Business",
      blurb:
        "Reliable administrative support for recurring business tasks.",
      description:
        "Virtual administrative support for organization, customer follow-up, research, scheduling, and routine business operations.",
      thumb: "data",
      rating: 4.8,
      reviews: 95,
      tiers: standardTiers(
        120,
        [
          "Task planning",
          "Administrative support",
          "Customer follow-up",
          "Research",
          "Progress updates",
          "Completion report",
        ],
        3,
      ),
      deliverables: [
        "Task planning",
        "Administrative support",
        "Customer follow-up",
        "Research",
        "Progress updates",
        "Completion report",
      ],
      tags: [
        "virtual assistant",
        "administration",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "local-seo",
      title: "Local SEO and Google Business setup",
      category: "seo_local_visibility",
      categoryName: "Local Visibility",
      blurb:
        "Improve your visibility in local search and maps.",
      description:
        "A local visibility package including business-profile review, website signals, directory consistency, and optimization guidance.",
      thumb: "seo",
      rating: 4.7,
      reviews: 152,
      tiers: standardTiers(
        99,
        [
          "Business profile review",
          "Local SEO checklist",
          "Directory review",
          "Website signals",
          "Optimization report",
          "Next-step plan",
        ],
        5,
      ),
      deliverables: [
        "Profile review",
        "Local SEO checklist",
        "Directory review",
        "Website recommendations",
        "Optimization report",
        "Next-step plan",
      ],
      tags: [
        "local seo",
        "google business",
        "maps",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "automation-setup",
      title: "Workflow automation setup",
      category: "automation_setup",
      categoryName: "AI Services",
      blurb:
        "Connect your tools with monitored business automations.",
      description:
        "A business workflow automation connecting approved tools, data, notifications, and recurring operational tasks.",
      thumb: "automation",
      rating: 4.9,
      reviews: 64,
      tiers: standardTiers(
        399,
        [
          "Workflow map",
          "Automation setup",
          "Error handling",
          "Testing",
          "Monitoring plan",
          "Handoff guide",
        ],
        7,
      ),
      deliverables: [
        "Workflow map",
        "Automation setup",
        "Testing",
        "Error handling",
        "Monitoring plan",
        "Handoff guide",
      ],
      tags: [
        "automation",
        "workflow",
        "integration",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "ai-assistant",
      title: "AI assistant setup",
      category: "ai_tool_setup",
      categoryName: "AI Services",
      blurb:
        "A business assistant configured around approved knowledge.",
      description:
        "A custom AI assistant configured for internal business support, customer assistance, or document-based workflows.",
      thumb: "ai",
      rating: 4.9,
      reviews: 51,
      tiers: standardTiers(
        399,
        [
          "Assistant configuration",
          "Knowledge setup",
          "Prompt design",
          "Testing",
          "Usage controls",
          "Handoff guide",
        ],
        7,
      ),
      deliverables: [
        "Assistant configuration",
        "Knowledge setup",
        "Prompt design",
        "Testing",
        "Usage controls",
        "Handoff guide",
      ],
      tags: [
        "ai assistant",
        "chatbot",
        "automation",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "content-writing",
      title: "Website content writing",
      category: "content_writing",
      categoryName: "Writing & Translation",
      blurb:
        "Clear website copy written for customers and search engines.",
      description:
        "Professional website content for service pages, landing pages, company information, and customer calls to action.",
      thumb: "flyer",
      rating: 4.8,
      reviews: 88,
      tiers: standardTiers(
        149,
        [
          "Page copy",
          "Headlines",
          "Calls to action",
          "SEO structure",
          "Tone alignment",
          "Revision round",
        ],
        5,
      ),
      deliverables: [
        "Page copy",
        "Headlines",
        "Calls to action",
        "SEO structure",
        "Tone alignment",
        "Revision",
      ],
      tags: [
        "copywriting",
        "website content",
        "writing",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "menu-design",
      title: "Restaurant menu design",
      category: "menu_design",
      categoryName: "Graphics & Design",
      blurb:
        "A professional print-ready restaurant menu.",
      description:
        "A restaurant menu designed for easy reading, strong branding, print production, and digital sharing.",
      thumb: "menu",
      rating: 4.9,
      reviews: 138,
      tiers: standardTiers(
        45,
        [
          "Menu layout",
          "Typography",
          "Price formatting",
          "Print-ready PDF",
          "Digital version",
          "Revision round",
        ],
        3,
      ),
      deliverables: [
        "Menu layout",
        "Typography",
        "Price formatting",
        "Print-ready PDF",
        "Digital version",
        "Revision",
      ],
      tags: [
        "menu design",
        "restaurant",
        "print",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "flyer-design",
      title: "Flyer and promotion design",
      category: "flyer_design",
      categoryName: "Graphics & Design",
      blurb:
        "Professional promotional material for campaigns and offers.",
      description:
        "A promotional flyer prepared for printing, social media, digital advertising, and local distribution.",
      thumb: "flyer",
      rating: 4.8,
      reviews: 201,
      tiers: standardTiers(
        30,
        [
          "Flyer design",
          "Print-ready PDF",
          "Social version",
          "Digital version",
          "Editable source",
          "Revision round",
        ],
        2,
      ),
      deliverables: [
        "Flyer design",
        "Print-ready PDF",
        "Social version",
        "Digital version",
        "Editable source",
        "Revision",
      ],
      tags: [
        "flyer",
        "promotion",
        "advertising design",
      ],
      intakeRequired: false,
      quoteAvailable: true,
    }),

    pkg({
      id: "ecommerce-store",
      title: "Shopify or WooCommerce store setup",
      category: "ecommerce_setup",
      categoryName: "Programming & Tech",
      blurb:
        "Storefront, products, payments, and shipping configured.",
      description:
        "A launch-ready ecommerce storefront with products, payment configuration, shipping rules, and customer notifications.",
      thumb: "ecommerce",
      rating: 4.8,
      reviews: 87,
      tiers: standardTiers(
        349,
        [
          "Store setup",
          "Product setup",
          "Payment configuration",
          "Shipping configuration",
          "Customer notifications",
          "Launch support",
        ],
        7,
      ),
      deliverables: [
        "Store setup",
        "Products",
        "Payment configuration",
        "Shipping rules",
        "Customer notifications",
        "Launch support",
      ],
      tags: [
        "shopify",
        "woocommerce",
        "ecommerce",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),

    pkg({
      id: "lead-campaign",
      title: "Qualified lead campaign setup",
      category: "lead_generation",
      categoryName: "Lead Generation",
      blurb:
        "A structured campaign for capturing and routing qualified leads.",
      description:
        "A lead-generation workflow covering the audience, offer, capture form, qualification, routing, and follow-up process.",
      thumb: "ai",
      rating: 4.8,
      reviews: 57,
      tiers: standardTiers(
        299,
        [
          "Audience definition",
          "Offer structure",
          "Lead form",
          "Qualification rules",
          "Lead routing",
          "Follow-up plan",
        ],
        7,
      ),
      deliverables: [
        "Audience definition",
        "Offer structure",
        "Lead form",
        "Qualification rules",
        "Lead routing",
        "Follow-up plan",
      ],
      tags: [
        "lead generation",
        "leads",
        "campaign",
      ],
      intakeRequired: true,
      quoteAvailable: true,
    }),
  ];

export function getMarketplaceCategory(
  slug: string,
): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find(
    (category) =>
      category.slug === slug,
  );
}

export function getMarketplacePackage(
  id: string,
): MarketplacePackage | undefined {
  return MARKETPLACE_PACKAGES.find(
    (item) => item.id === id,
  );
}

export function getMarketplacePackages(
  category?: string,
): MarketplacePackage[] {
  if (!category) {
    return MARKETPLACE_PACKAGES;
  }

  return MARKETPLACE_PACKAGES.filter(
    (item) =>
      item.category === category,
  );
}

export function shortestDelivery(
  item: MarketplacePackage,
): number {
  return Math.min(
    ...item.tiers.map(
      (tierItem) =>
        tierItem.deliveryDays,
    ),
  );
}

export function startingPriceCents(
  item: MarketplacePackage,
): number {
  return Math.min(
    ...item.tiers.map(
      (tierItem) =>
        tierItem.priceCents,
    ),
  );
}

export function formatStartingPrice(
  item: MarketplacePackage,
): string {
  return `$${Math.round(
    startingPriceCents(item) / 100,
  ).toLocaleString("en-CA")}`;
}

export function relatedPackages(
  item: MarketplacePackage,
  limit = 3,
): MarketplacePackage[] {
  return MARKETPLACE_PACKAGES.filter(
    (candidate) =>
      candidate.id !== item.id &&
      (candidate.category ===
        item.category ||
        candidate.tags.some((tag) =>
          item.tags.includes(tag),
        )),
  ).slice(0, limit);
}

export function searchMarketplacePackages(
  query: string,
  category?: string,
): MarketplacePackage[] {
  const normalized =
    query.trim().toLowerCase();

  return MARKETPLACE_PACKAGES.filter(
    (item) => {
      if (
        category &&
        item.category !== category
      ) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [
        item.title,
        item.categoryName,
        item.blurb,
        item.description,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    },
  );
}