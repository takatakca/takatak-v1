/**
 * Human labels for the security screens: "Chrome sur Windows", "Safari sur
 * iPhone". Read from the User-Agent only to describe the device to its owner;
 * never used to recognise a device (that is the random device cookie).
 */

type Lang = "fr" | "en";

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function deviceLabel(userAgent: string | null | undefined, lang: Lang = "fr"): string {
  const ua = (userAgent ?? "").slice(0, 512);
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  const unknown = lang === "fr" ? "Appareil inconnu" : "Unknown device";
  if (!browser && !system) return unknown;
  if (!system) return browser!;
  if (!browser) return system;
  return lang === "fr" ? `${browser} sur ${system}` : `${browser} on ${system}`;
}

/** "203.0.113.x" or "2001:db8:85a3:…": enough to recognise a network, not a person. */
export function ipHint(ip: string | null | undefined): string | null {
  const value = (ip ?? "").split(",")[0].trim();
  if (!value) return null;
  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.x`;
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}:…`;
  return null;
}
