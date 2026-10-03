// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

const isVercelBuild = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;
const nitroPreset = isVercelBuild ? "vercel" : null;

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// Files in public/ aren't content-hashed, so Vercel serves them with max-age=0 and every
// page view re-requests them. Let browsers keep them; sw.js and the manifest stay fresh.
const vercelStaticCacheRoutes = [
  {
    src: "^/uploads/(.*)$",
    headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=2592000" },
    continue: true,
  },
  {
    src: "^/(logo\\.png|app-icon\\.jpg|icon-192\\.png|icon-512\\.png|whatsapp\\.svg)$",
    headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" },
    continue: true,
  },
];

export default defineConfig({
  cloudflare: nitroPreset ? false : undefined,
  plugins: nitroPreset
    ? [nitro({ preset: nitroPreset, vercel: { config: { routes: vercelStaticCacheRoutes } } } as any)]
    : [],
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("recharts")) return "chart-vendor";
            if (id.includes("embla-carousel-react")) return "carousel-vendor";
            // Server-only Start internals must stay out of the shared vendor chunk, or the
            // SSR bundle gets a circular chunk import ("createRequestHandler is not defined").
            if (id.includes("@tanstack/start-server-core") || id.includes("@tanstack/react-start-server")) {
              return undefined;
            }
            if (id.includes("@tanstack")) return "tanstack-vendor";
            if (
              id.includes("@radix-ui") ||
              id.includes("lucide-react") ||
              id.includes("sonner") ||
              id.includes("cmdk") ||
              id.includes("vaul")
            ) {
              return "ui-vendor";
            }
            if (id.includes("react")) return "react-vendor";
            return undefined;
          },
        },
      },
    },
  },
});
