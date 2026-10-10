export type R2FNeedType =
  | "problem"
  | "emergency"
  | "project"
  | "maintenance"
  | "service";

export type R2FMarket = "residential" | "commercial";

export type R2FPropertyType =
  | "house"
  | "condo"
  | "duplex_triplex"
  | "rental_building"
  | "commercial"
  | "other";

export type R2FUrgency =
  | "urgent"
  | "days"
  | "weeks"
  | "planning";

export interface R2FLeadRequest {
  version: 1;
  requestId: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    preferredLanguage: "fr" | "en";
  };
  project: {
    needType: R2FNeedType;
    serviceCategory: string;
    serviceSubcategory: string | null;
    problemType: string | null;
    market: R2FMarket;
    propertyType: R2FPropertyType;
    urgency: R2FUrgency;
    city: string;
    postalCode: string;
    description: string;
    budgetCents: number | null;
  };
  attribution: {
    sourcePage: string | null;
    referrer: string | null;
    channel: string | null;
    campaign: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    gclid: string | null;
    fbclid: string | null;
    ttclid: string | null;
  };
  consent: {
    contact: true;
    marketing: boolean;
    capturedAt: string | null;
  };
}
