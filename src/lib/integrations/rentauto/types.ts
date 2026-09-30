export type ConsentRecord = {
    type: string;
    status: "GRANTED" | "DENIED" | "REVOKED";
    recordedAt: string;
  };
  
  export type RentautoAddress = {
    id: string;
    type: "CLEANING_SERVICE" | "HOME" | "BILLING" | string;
    line1: string;
    line2?: string;
    city: string;
    province?: string;
    postalCode?: string;
    country: string;
    active?: boolean;
  };
  
  export type RentautoProfileFields = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    locale?: "en" | "fr" | "es";
    accountStatus?: string;
    registeredAt?: string;
    updatedAt?: string;
    addresses?: RentautoAddress[];
  };
  
  export type RentautoProfileEvent = {
    eventId: string;
    eventType:
      | "CUSTOMER_REGISTERED"
      | "PROFILE_UPDATED"
      | "ADDRESS_UPDATED"
      | "ACCOUNT_STATUS_UPDATED";
    sourceApplication: "RENTAUTO";
    externalUserId: string;
    collectedFields: RentautoProfileFields;
    verifiedFields: Array<
      "firstName" | "lastName" | "email" | "phone"
    >;
    consentRecords: ConsentRecord[];
    occurredAt: string;
  };
  
  export type RentautoPaymentEvent = {
    eventId: string;
    eventType: "PAYMENT_SUMMARY_UPDATED";
    sourceApplication: "RENTAUTO";
    externalUserId: string;
    payment: {
      bookingNumber: string;
      status:
        | "PENDING"
        | "PAID"
        | "FAILED"
        | "REFUNDED"
        | "PARTIALLY_REFUNDED";
      amount: number;
      refundedAmount?: number;
      currency: string;
      transactionDate: string;
      stripeCustomerReference?: string;
    };
    occurredAt: string;
  };
  
  export type RentautoEvent =
    | RentautoProfileEvent
    | RentautoPaymentEvent;