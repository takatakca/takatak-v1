export type PrismaKnownRequestError = {
  code: string;
  meta?: { target?: unknown };
};

export function isPrismaKnownRequestError(
  error: unknown,
): error is PrismaKnownRequestError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (!("code" in error)) {
    return false;
  }

  const code = (error as { code: unknown }).code;
  return typeof code === "string" && /^P\d{4}$/.test(code);
}
