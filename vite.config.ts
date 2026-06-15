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
export default defineConfig({
  cloudflare: nitroPreset ? false : undefined,
  plugins: nitroPreset ? [nitro({ preset: nitroPreset })] : [],
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
