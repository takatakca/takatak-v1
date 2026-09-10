import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { normalizeEmail } from "@/lib/auth/registration-validation";

type MemoryOtpRecord = {
  otp: string;
  at: number;
};

function storePath(): string {
  return process.env.OTP_MEMORY_PATH?.trim() || "/tmp/takatak-otp-memory.json";
}

function readStore(): Record<string, MemoryOtpRecord> {
  try {
    return JSON.parse(readFileSync(storePath(), "utf8")) as Record<
      string,
      MemoryOtpRecord
    >;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, MemoryOtpRecord>): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store), { mode: 0o600 });
}

export async function sendOtpToMemory(email: string, otp: string): Promise<void> {
  const key = normalizeEmail(email);
  const store = readStore();
  store[key] = { otp, at: Date.now() };
  writeStore(store);
}

export function readMemoryOtp(email: string): string | null {
  const record = readStore()[normalizeEmail(email)];
  if (!record?.otp) return null;
  return record.otp;
}
