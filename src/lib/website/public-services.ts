export interface PublicServiceDefinition {
    slug: string;
    title: string;
    shortDescription: string;
    longDescription: string;
    status: "live" | "beta";
    ctaLabel: string;
    dashboardRoute: string;
  }
  
  export const PUBLIC_SERVICES: PublicServiceDefinition[] =
    [
      {
        slug: "websites",
        title: "Website Creation",
        shortDescription:
          "Custom websites built around your brand, offer, content, and conversion goals.",
        longDescription:
          "Tell TAKATAK about your business. We structure the copy, design, pages, integrations, and managed launch process.",
        status: "beta",
        ctaLabel: "Start website intake",
        dashboardRoute:
          "/dashboard/websites",
      },
      {
        slug: "mobile-apps",
        title: "Mobile App Creation",
        shortDescription:
          "Plan and launch mobile app projects with a structured brief and managed delivery process.",
        longDescription:
          "From initial idea to launch planning, TAKATAK organizes features, screens, integrations, milestones, and delivery.",
        status: "beta",
        ctaLabel: "Start app intake",
        dashboardRoute:
          "/dashboard/mobile-apps",
      },
      {
        slug: "voip",
        title: "VoIP Business Phone",
        shortDescription:
          "Business phone numbers, routing, voicemail, and call-handling tools.",
        longDescription:
          "Set up a professional business phone system with numbers, IVR menus, routing, voicemail, and operational call flows.",
        status: "beta",
        ctaLabel: "Set up VoIP",
        dashboardRoute:
          "/dashboard/voip",
      },
      {
        slug: "marketing",
        title: "Online Marketing",
        shortDescription:
          "Campaign planning, advertising setup, tracking, and measurable growth.",
        longDescription:
          "TAKATAK structures audiences, advertising, landing pages, campaign tracking, and reporting workflows.",
        status: "beta",
        ctaLabel:
          "Start marketing intake",
        dashboardRoute:
          "/dashboard/marketing",
      },
      {
        slug: "social-media",
        title: "Social Media Automation",
        shortDescription:
          "Content planning, publishing workflows, and channel organization.",
        longDescription:
          "Plan content, organize approvals, schedule publishing, manage connected accounts, and measure results through TAKATAK.",
        status: "beta",
        ctaLabel: "Set up social",
        dashboardRoute:
          "/dashboard/social",
      },
      {
        slug: "local-listings",
        title: "Local Listing Visibility",
        shortDescription:
          "Improve how your business appears across maps, directories, and local search.",
        longDescription:
          "Organize business information, listings, locations, review workflows, and local visibility through QMAPS.",
        status: "beta",
        ctaLabel: "Claim listings",
        dashboardRoute:
          "/dashboard/local-listings",
      },
      {
        slug: "lead-generation",
        title: "Lead Generation",
        shortDescription:
          "Build a lead-acquisition system with intake, routing, tracking, and follow-up.",
        longDescription:
          "Define your audience and TAKATAK structures lead capture, qualification, assignment, and follow-up through FLEXS.",
        status: "beta",
        ctaLabel: "Set up lead gen",
        dashboardRoute:
          "/dashboard/leads",
      },
      {
        slug: "ai-business-tools",
        title:
          "AI-Assisted Business Tools",
        shortDescription:
          "Practical automation tools that reduce manual work and organize operations.",
        longDescription:
          "TAKATAK builds approved AI assistants, document workflows, internal tools, and operational automations.",
        status: "beta",
        ctaLabel:
          "Describe your workflow",
        dashboardRoute:
          "/dashboard/ai-studio",
      },
      {
        slug: "marketplace",
        title:
          "TAKATAK Service Marketplace",
        shortDescription:
          "Request websites, design, content, technology, and business tasks through TAKATAK.",
        longDescription:
          "Browse fixed packages or post a custom project with milestones, communication, delivery, and TAKATAK-managed approval.",
        status: "beta",
        ctaLabel: "Browse marketplace",
        dashboardRoute:
          "/dashboard/marketplace",
      },
    ];
  
  export function getPublicService(
    slug: string,
  ): PublicServiceDefinition | undefined {
    return PUBLIC_SERVICES.find(
      (service) =>
        service.slug === slug,
    );
  }