// TV mode: makes takatak.ca usable with a TV remote (arrows, OK, Back) on smart TVs
// (Google TV, Fire TV, Samsung Tizen, LG webOS, Xbox…). Turned on by the TV's user agent,
// or by hand with ?tv=1 (?tv=0 turns it off); the choice is remembered on the device.
// Same behaviour as BesoinAvocat (platform/public/pwa.js), the "apps partout" standard.

export const TV_AGENT =
  /\b(?:SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|AFT[A-Z0-9]*|BRAVIA|GoogleTV|Android TV|AndroidTV|CrKey|HbbTV|Roku|VIDAA|Xbox)\b/iu;
const STORAGE_KEY = "takatak-tv";
// Remote "Back" keys: Samsung Tizen (10009), LG webOS (461); Fire TV / Android TV send Escape or BrowserBack.
export const TV_BACK_KEY_CODES = new Set([10009, 461]);
const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function tvModeWanted(search: string, userAgent: string, saved: string | null): { tv: boolean; remember: string | null } {
  const flag = new URLSearchParams(search).get("tv");
  if (flag === "1" || flag === "0") return { tv: flag === "1", remember: flag };
  if (saved === "1" || saved === "0") return { tv: saved === "1", remember: null };
  return { tv: TV_AGENT.test(userAgent), remember: null };
}

function visible(el: HTMLElement) {
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (r.bottom + window.scrollY < 0 || r.right + window.scrollX < 0) return false;
  const s = window.getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none";
}

function candidates() {
  const dialog = [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]:not([hidden])')].pop();
  return [...(dialog ?? document).querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

function typing(el: Element | null) {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el instanceof HTMLInputElement) return !/^(?:button|submit|reset|checkbox|radio|file|range|color)$/iu.test(el.type);
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function move(dx: number, dy: number) {
  const items = candidates();
  if (!items.length) return false;
  const active = document.activeElement as HTMLElement | null;
  const current = active && active !== document.body && items.includes(active) ? active : null;
  if (!current) {
    items[0].focus();
    return true;
  }
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy;
    if (along <= 1) continue;
    const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return false;
  best.focus({ preventScroll: true });
  best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  return true;
}

/** Turns TV mode on when wanted; returns a cleanup function. */
export function enableTvMode(): () => void {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage may be blocked */
  }
  const { tv, remember } = tvModeWanted(window.location.search, navigator.userAgent || "", saved);
  if (remember) {
    try {
      window.localStorage.setItem(STORAGE_KEY, remember);
    } catch {
      /* storage may be blocked */
    }
  }
  if (!tv) return () => undefined;
  document.documentElement.classList.add("tv-mode");

  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const active = document.activeElement as HTMLElement | null;
    if (TV_BACK_KEY_CODES.has(event.keyCode) || event.key === "BrowserBack" || event.key === "GoBack") {
      event.preventDefault();
      if (typing(active)) {
        active?.blur();
        return;
      }
      const open = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].pop();
      if (open) {
        open.close();
        return;
      }
      if (window.history.length > 1) window.history.back();
      return;
    }
    const dir = DIRECTIONS[event.key];
    if (!dir) return;
    // Inside a text field, left/right move the caret; up/down leave the field.
    if (typing(active) && dir[0] !== 0) return;
    if (move(dir[0], dir[1])) event.preventDefault();
  };
  document.addEventListener("keydown", onKey);

  if (!document.activeElement || document.activeElement === document.body) {
    const first = document.querySelector<HTMLElement>(`main ${FOCUSABLE.split(", ").join(", main ")}`) ?? candidates()[0];
    if (first && visible(first)) first.focus({ preventScroll: true });
  }
  return () => {
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("tv-mode");
  };
}
