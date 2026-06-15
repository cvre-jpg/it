export const siteConfig = {
  name: "Shop ICT Gadgets",
  shortName: "Shop ICT",
  description:
    "Shop fast laptops, monitors, phones, audio gear, and business electronics with SEO-ready product pages and conversion-focused browsing.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://shopictgadgets.co.ke").replace(/\/+$/, ""),
  locale: "en_KE",
  currency: "KES",
  email: "hello@shopictgadgets.co.ke",
  phone: "+254700000000",
  social: {
    twitter: "@shopictgadgets",
  },
};

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
