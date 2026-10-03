const RAW_SITE_URL =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.SITE_URL?.trim() ||
  "https://shopictgadgets.co.ke";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export function absoluteUrl(path = "/") {
  // Image URLs from Cloudinary or the old site are already absolute; don't prefix them.
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function buildTitle(value: string) {
  return `${value} - Shop ICT Gadgets`;
}

export function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    // Some imported descriptions contain a literal "\n" (backslash + n) instead of a line break.
    .replace(/\\[nrt]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

// JSON for <script type="application/ld+json">. Escaping "<" keeps text such as "</script>"
// inside product data from ending the script tag early.
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildMetaDescription(
  value: string | null | undefined,
  fallback: string,
  maxLength = 160,
) {
  const source = cleanText(value) || fallback;
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength - 3).trim()}...`;
}
