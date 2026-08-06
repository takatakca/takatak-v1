export const PROMO_CODE = "FIRST10";
export const PROMO_PERCENT = 10;

export type PromoStatus =
  | "none"
  | "pending"
  | "claimed"
  | "used"
  | "dismissed";

export interface PromoState {
  code: string;
  percentOff: number;
  status: PromoStatus;
  claimedAt?: string;
  usedAt?: string;
}

const KEY = "takatak.promo.first10";

const DISMISS_KEY =
  "takatak.promo.bar.dismissed";

const MODAL_KEY =
  "takatak.promo.modal.shown";

const STICKY_KEY =
  "takatak.promo.sticky.dismissed";

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof localStorage !== "undefined"
  );
}

function read<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const value =
      localStorage.getItem(key);

    return value
      ? (JSON.parse(value) as T)
      : null;
  } catch {
    return null;
  }
}

function write(
  key: string,
  value: unknown,
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Private mode and storage quota failures
    // must not block the public website.
  }
}

export function getPromoState(): PromoState {
  return (
    read<PromoState>(KEY) ?? {
      code: PROMO_CODE,
      percentOff: PROMO_PERCENT,
      status: "none",
    }
  );
}

export function savePendingPromo(): PromoState {
  const current = getPromoState();

  if (
    current.status === "claimed" ||
    current.status === "used"
  ) {
    return current;
  }

  const next: PromoState = {
    ...current,
    status: "pending",
  };

  write(KEY, next);

  return next;
}

export function dismissPromoBar(): void {
  write(DISMISS_KEY, {
    at: Date.now(),
  });
}

export function isPromoBarDismissed(): boolean {
  return Boolean(
    read<{ at: number }>(DISMISS_KEY),
  );
}

export function dismissStickyPromo(): void {
  write(STICKY_KEY, {
    at: Date.now(),
  });
}

export function isStickyPromoDismissed(): boolean {
  return Boolean(
    read<{ at: number }>(STICKY_KEY),
  );
}

export function markModalShown(): void {
  write(MODAL_KEY, {
    at: Date.now(),
  });
}

export function wasModalShown(): boolean {
  return Boolean(
    read<{ at: number }>(MODAL_KEY),
  );
}

export type PromoEvent =
  | "promo_banner_viewed"
  | "promo_banner_clicked"
  | "signup_promo_viewed"
  | "signup_promo_claimed";

export function trackPromo(
  event: PromoEvent,
  payload: Record<string, unknown> = {},
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    const currentWindow =
      window as unknown as {
        dataLayer?: Array<
          Record<string, unknown>
        >;
      };

    currentWindow.dataLayer =
      currentWindow.dataLayer ?? [];

    currentWindow.dataLayer.push({
      event,
      promo_code: PROMO_CODE,
      ...payload,
    });
  } catch {
    // Analytics must never block the website.
  }
}