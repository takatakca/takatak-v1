export function parseBlogHost(value: string): string | null {
  let host = value.trim().toLowerCase();
  if (!host || host.length > 253) return null;

  try {
    host = decodeURIComponent(host);
  } catch {
    return null;
  }

  if (
    host.includes("/") ||
    host.includes("@") ||
    host.includes("..") ||
    host.startsWith(".") ||
    host.endsWith(".")
  ) {
    return null;
  }

  if (!/^[a-z0-9.-]+$/.test(host)) return null;

  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (
    !labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        !label.startsWith("-") &&
        !label.endsWith("-"),
    )
  ) {
    return null;
  }

  return host;
}

export function takatakBlogPath(host: string): string {
  return `/blog/${host}`;
}
