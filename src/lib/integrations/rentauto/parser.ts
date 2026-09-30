import type {
    RentautoEvent,
    RentautoPaymentEvent,
    RentautoProfileEvent,
  } from "./types";
  
  const forbiddenFields = new Set([
    "password",
    "passwordHash",
    "otp",
    "otpCode",
    "session",
    "sessionToken",
    "cardNumber",
    "cvc",
    "cvv",
    "clientSecret",
    "doorCode",
    "alarmCode",
    "entryInstructions",
    "privateBookingNotes",
    "accessToken",
    "refreshToken",
    "serviceRoleKey",
    "stripeSecretKey",
    "stripePaymentIntentId",
    "stripeSessionId",
    "vin",
    "plate",
    "licensePlate",
    "driverLicense",
    "driverLicenseNumber",
    "registrationDocument",
    "insuranceDocument",
    "tripPhoto",
    "tripPhotos",
    "gps",
    "gpsHistory",
    "latitude",
    "longitude",
    "lat",
    "lng",
  ]);
  
  function isObject(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }
  
  function containsForbiddenField(
    value: unknown,
  ): boolean {
    if (Array.isArray(value)) {
      return value.some(containsForbiddenField);
    }
  
    if (!isObject(value)) {
      return false;
    }
  
    return Object.entries(value).some(
      ([key, nestedValue]) =>
        forbiddenFields.has(key) ||
        containsForbiddenField(nestedValue),
    );
  }
  
  function validString(
    value: unknown,
    maximumLength = 500,
  ): value is string {
    return (
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= maximumLength
    );
  }
  
  function validDate(value: unknown): value is string {
    return (
      validString(value, 64) &&
      !Number.isNaN(Date.parse(value))
    );
  }
  
  export function parseRentautoEvent(
    rawBody: string,
  ):
    | { valid: true; event: RentautoEvent }
    | { valid: false; error: string } {
    let body: unknown;
  
    try {
      body = JSON.parse(rawBody);
    } catch {
      return {
        valid: false,
        error: "Invalid JSON body.",
      };
    }
  
    if (!isObject(body)) {
      return {
        valid: false,
        error: "Body must be a JSON object.",
      };
    }
  
    if (containsForbiddenField(body)) {
      return {
        valid: false,
        error: "Payload contains a forbidden field.",
      };
    }
  
    if (
      !validString(body.eventId, 200) ||
      !validString(body.eventType, 100) ||
      body.sourceApplication !== "RENTAUTO" ||
      !validString(body.externalUserId, 200) ||
      !validDate(body.occurredAt)
    ) {
      return {
        valid: false,
        error: "Required event fields are invalid.",
      };
    }
  
    if (body.eventType === "PAYMENT_SUMMARY_UPDATED") {
      if (!isObject(body.payment)) {
        return {
          valid: false,
          error: "Payment summary is required.",
        };
      }
  
      const payment = body.payment;
      const paymentStatuses = new Set([
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ]);
  
      if (
        !validString(payment.bookingNumber, 200) ||
        !validString(payment.status, 50) ||
        !paymentStatuses.has(payment.status) ||
        !Number.isSafeInteger(payment.amount) ||
        Number(payment.amount) < 0 ||
        Number(payment.amount) > 2_147_483_647 ||
        !validString(payment.currency, 3) ||
        !/^[A-Za-z]{3}$/.test(payment.currency) ||
        !validDate(payment.transactionDate)
      ) {
        return {
          valid: false,
          error: "Payment summary is invalid.",
        };
      }
  
      if (
        payment.refundedAmount !== undefined &&
        (
          !Number.isSafeInteger(payment.refundedAmount) ||
          Number(payment.refundedAmount) < 0 ||
          Number(payment.refundedAmount) >
            Number(payment.amount)
        )
      ) {
        return {
          valid: false,
          error: "Refunded amount is invalid.",
        };
      }
  
      const event: RentautoPaymentEvent = {
        eventId: body.eventId,
        eventType: "PAYMENT_SUMMARY_UPDATED",
        sourceApplication: "RENTAUTO",
        externalUserId: body.externalUserId,
        occurredAt: body.occurredAt,
        payment: {
          bookingNumber: payment.bookingNumber.trim(),
          status:
            payment.status as RentautoPaymentEvent["payment"]["status"],
          amount: Number(payment.amount),
          currency: payment.currency.toUpperCase(),
          transactionDate: payment.transactionDate,
          ...(payment.refundedAmount === undefined
            ? {}
            : {
                refundedAmount: Number(
                  payment.refundedAmount,
                ),
              }),
          ...(validString(
            payment.stripeCustomerReference,
            200,
          )
            ? {
                stripeCustomerReference:
                  payment.stripeCustomerReference.trim(),
              }
            : {}),
        },
      };
  
      return {
        valid: true,
        event,
      };
    }
  
    const profileEventTypes = new Set([
      "CUSTOMER_REGISTERED",
      "PROFILE_UPDATED",
      "ADDRESS_UPDATED",
      "ACCOUNT_STATUS_UPDATED",
    ]);
  
    if (
      !profileEventTypes.has(body.eventType) ||
      !isObject(body.collectedFields)
    ) {
      return {
        valid: false,
        error: "Profile event is invalid.",
      };
    }
  
    const verifiedFields = Array.isArray(
      body.verifiedFields,
    )
      ? body.verifiedFields
      : [];
  
    const acceptedVerifiedFields = new Set([
      "firstName",
      "lastName",
      "email",
      "phone",
    ]);
  
    if (
      verifiedFields.some(
        (field) =>
          typeof field !== "string" ||
          !acceptedVerifiedFields.has(field),
      )
    ) {
      return {
        valid: false,
        error: "verifiedFields contains an invalid value.",
      };
    }
  
    const event: RentautoProfileEvent = {
      eventId: body.eventId,
      eventType:
        body.eventType as RentautoProfileEvent["eventType"],
      sourceApplication: "RENTAUTO",
      externalUserId: body.externalUserId,
      collectedFields:
        body.collectedFields as RentautoProfileEvent["collectedFields"],
      verifiedFields:
        verifiedFields as RentautoProfileEvent["verifiedFields"],
      consentRecords: Array.isArray(body.consentRecords)
        ? body.consentRecords as RentautoProfileEvent["consentRecords"]
        : [],
      occurredAt: body.occurredAt,
    };
  
    return {
      valid: true,
      event,
    };
  }