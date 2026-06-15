import { createFileRoute } from "@tanstack/react-router";
import { fetchProducts } from "@/lib/products";
import { absoluteUrl } from "@/lib/seo";
import { buildUrlSet, toIsoDate, xmlResponse, type SitemapEntry } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap-products.xml")({
  server: {
    handlers: {
      GET: async () => {
        const products = await fetchProducts({ limit: 5000 });
        const entries: SitemapEntry[] = products.map((product: any) => ({
          loc: absoluteUrl(`/products/${encodeURIComponent(product.slug)}`),
          lastmod: toIsoDate(product.updated_at ?? product.created_at ?? null),
        }));

        return xmlResponse(buildUrlSet(entries));
      },
    },
  },
});
