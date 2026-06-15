import { absoluteUrl } from "@/lib/seo";

export type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
};

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function toIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

export function buildUrlSet(entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `
    <lastmod>${entry.lastmod}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;
}

export function buildSitemapIndex(paths: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (path) => `  <sitemap>
    <loc>${escapeXml(absoluteUrl(path))}</loc>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;
}
