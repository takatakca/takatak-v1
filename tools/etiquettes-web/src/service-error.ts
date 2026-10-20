export type ServiceErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "unavailable";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ServiceErrorCode,
    message: string,
    options?: {
      status?: number;
      fieldErrors?: Record<string, string>;
    },
  ) {
    super(message);

    this.name = "ServiceError";
    this.code = code;

    this.status =
      options?.status ??
      (code === "invalid_input"
        ? 400
        : code === "forbidden"
          ? 403
          : code === "not_found"
            ? 404
            : code === "conflict"
              ? 409
              : 503);

    this.fieldErrors = options?.fieldErrors;
  }
}

export function isServiceError(
  value: unknown,
): value is ServiceError {
  return value instanceof ServiceError;
}