import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapIndex, xmlResponse } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        return xmlResponse(
          buildSitemapIndex(["/sitemap-pages.xml", "/sitemap-categories.xml", "/sitemap-products.xml"]),
        );
      },
    },
  },
});
