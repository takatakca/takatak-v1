// Pure: safe for the browser bundle and for tests.

/**
 * Maps Supabase Auth phone-OTP errors to a message that says what to do.
 * Error codes first (stable), then message text for older servers.
 */
export function phoneAuthMessage(message: string, code?: string | null) {
  const value = `${code ?? ""} ${message}`.toLowerCase();
  if (value.includes("rate") || value.includes("too many") || value.includes("security purposes")) {
    return "Too many verification requests. Please wait a minute and try again.";
  }
  // No identity has this phone yet; sign-in never creates accounts.
  if (value.includes("otp_disabled") || value.includes("signups not allowed")) {
    return "No TAKATAK identity uses this mobile number yet. Create your identity first, or sign in with email.";
  }
  if (value.includes("phone_provider_disabled") || value.includes("unsupported phone provider")) {
    return "SMS sign-in is not enabled on this TAKATAK environment yet. Use email for now.";
  }
  if (value.includes("sms_send_failed") || value.includes("sending") || value.includes("twilio")) {
    return "The SMS provider could not deliver the code. Check the number, or sign in with email.";
  }
  if (value.includes("provider") || value.includes("disabled")) {
    return "TAKATAK SMS verification is temporarily unavailable.";
  }
  return "Unable to send the TAKATAK SMS code. Please try again.";
}
