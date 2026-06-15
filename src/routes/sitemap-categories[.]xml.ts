import { createFileRoute } from "@tanstack/react-router";
import { CATEGORY_TREE } from "@/lib/category-tree";
import { absoluteUrl } from "@/lib/seo";
import { buildUrlSet, xmlResponse, type SitemapEntry } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap-categories.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = CATEGORY_TREE.flatMap((category) => [
          { loc: absoluteUrl(`/shop?category=${encodeURIComponent(category.query)}`) },
          ...category.items.map((subcategory) => ({
            loc: absoluteUrl(
              `/shop?category=${encodeURIComponent(category.query)}&subcategory=${encodeURIComponent(subcategory)}`,
            ),
          })),
        ]);

        return xmlResponse(buildUrlSet(entries));
      },
    },
  },
});
