const RAW_SITE_URL =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.SITE_URL?.trim() ||
  "https://shopictgadgets.co.ke";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export function absoluteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function buildTitle(value: string) {
  return `${value} - Shop ICT Gadgets`;
}

export function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
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
