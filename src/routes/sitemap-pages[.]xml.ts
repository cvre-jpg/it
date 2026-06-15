import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo";
import { buildUrlSet, xmlResponse, type SitemapEntry } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { loc: absoluteUrl("/") },
          { loc: absoluteUrl("/shop") },
          { loc: absoluteUrl("/contact") },
        ];

        return xmlResponse(buildUrlSet(entries));
      },
    },
  },
});
