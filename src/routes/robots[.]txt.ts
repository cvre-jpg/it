import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo";

const BLOCKED_CRAWLERS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "DataForSeoBot",
];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          "",
          "Disallow: /admin",
          "Disallow: /auth",
          "Disallow: /cart",
          "Disallow: /wishlist",
          "Disallow: /_serverFn/",
          // Search and filter combinations are endless and each one is a function call;
          // category pages (?category=, ?subcategory=) stay crawlable.
          "Disallow: /*?*q=",
          "Disallow: /*?*brands=",
          "Disallow: /*?*minPrice=",
          "Disallow: /*?*maxPrice=",
          "",
          // High-volume AI-training and SEO-scraper crawlers that bring no shoppers.
          ...BLOCKED_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]),
          `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
