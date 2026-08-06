import {
    createHash,
    randomBytes,
  } from "node:crypto";
  
  const INVITATION_TOKEN_BYTES = 32;
  const INVITATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
  
  export type GeneratedInvitationToken = {
    token: string;
    tokenHash: string;
  };
  
  export function isValidInvitationToken(
    token: string,
  ): boolean {
    return INVITATION_TOKEN_PATTERN.test(token.trim());
  }
  
  export function hashInvitationToken(
    token: string,
  ): string {
    const normalizedToken = token.trim().toLowerCase();
  
    if (!isValidInvitationToken(normalizedToken)) {
      throw new Error("Invalid invitation token.");
    }
  
    return createHash("sha256")
      .update(normalizedToken, "utf8")
      .digest("hex");
  }
  
  export function generateInvitationToken(): GeneratedInvitationToken {
    const token = randomBytes(
      INVITATION_TOKEN_BYTES,
    ).toString("hex");
  
    return {
      token,
      tokenHash: hashInvitationToken(token),
    };
  }