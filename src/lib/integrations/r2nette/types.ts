export type ConsentRecord = {
    type: string;
    status: "GRANTED" | "DENIED" | "REVOKED";
    recordedAt: string;
  };
  
  export type R2NetteAddress = {
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
  
  export type R2NetteProfileFields = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    locale?: "en" | "fr" | "es";
    accountStatus?: string;
    registeredAt?: string;
    updatedAt?: string;
    addresses?: R2NetteAddress[];
  };
  
  export type R2NetteProfileEvent = {
    eventId: string;
    eventType:
      | "CUSTOMER_REGISTERED"
      | "PROFILE_UPDATED"
      | "ADDRESS_UPDATED"
      | "ACCOUNT_STATUS_UPDATED";
    sourceApplication: "R2NETTE";
    externalUserId: string;
    collectedFields: R2NetteProfileFields;
    verifiedFields: Array<
      "firstName" | "lastName" | "email" | "phone"
    >;
    consentRecords: ConsentRecord[];
    occurredAt: string;
  };
  
  export type R2NettePaymentEvent = {
    eventId: string;
    eventType: "PAYMENT_SUMMARY_UPDATED";
    sourceApplication: "R2NETTE";
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
  
  export type R2NetteEvent =
    | R2NetteProfileEvent
    | R2NettePaymentEvent;