import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { DesktopWhatsAppFloat } from "@/components/desktop-whatsapp-float";
import { ProductFinderFloat } from "@/components/product-finder-float";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { StoreProvider } from "@/hooks/use-store";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";
import { absoluteUrl } from "@/lib/seo";
import { consumePendingExternalReturn, persistLastVisitedRoute } from "@/lib/whatsapp";

const QUERY_CACHE_STORAGE_KEY = "shop-ict-query-cache-v3";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
                } catch {
                  // Ignore storage access issues and still retry the route tree.
                }
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#E30613" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Shop ICT Gadgets — Premium Electronics in Kenya" },
      {
        name: "description",
        content: "Laptops, smartphones, networking, CCTV and gaming gear. Order instantly via WhatsApp.",
      },
      { property: "og:title", content: "Shop ICT Gadgets" },
      {
        property: "og:description",
        content: "Premium electronics in Kenya, ordered via WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { property: "og:image", content: absoluteUrl("/logo.png") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Shop ICT Gadgets" },
      {
        name: "twitter:description",
        content: "Premium electronics in Kenya, ordered via WhatsApp.",
      },
      { name: "twitter:image", content: absoluteUrl("/logo.png") },
    ],
    links: [
      { rel: "canonical", href: absoluteUrl("/") },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/app-icon.jpg", type: "image/jpeg" },
      { rel: "shortcut icon", href: "/app-icon.jpg", type: "image/jpeg" },
      { rel: "apple-touch-icon", href: "/app-icon.jpg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.history && "scrollRestoration" in window.history) {
                  window.history.scrollRestoration = "manual";
                }
                window.scrollTo(0, 0);
              } catch (error) {}
            `,
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/admin");
  const isAuth = path.startsWith("/auth");

  useEffect(() => {
    if (isAdmin || isAuth || typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [isAdmin, isAuth, path]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    if (import.meta.env.DEV || isLocalhost) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );

      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }

      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Failed to register service worker", error);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isAdmin || isAuth) return;

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
    const restoreUrl = consumePendingExternalReturn(currentUrl);
    if (restoreUrl && restoreUrl !== currentUrl) {
      window.location.replace(restoreUrl);
      return;
    }

    persistLastVisitedRoute(currentUrl);
  }, [path, isAdmin, isAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <div className="flex min-h-screen flex-col">
            {!isAdmin && !isAuth && <Header />}
            <main className="flex-1 pb-24 lg:pb-0">
              <Outlet />
            </main>
            {!isAdmin && !isAuth && <Footer />}
            {!isAdmin && !isAuth && <DesktopWhatsAppFloat />}
            {!isAdmin && !isAuth && <ProductFinderFloat />}
            {!isAdmin && !isAuth && <MobileBottomNav />}
            {!isAdmin && !isAuth && <PwaInstallPrompt />}
          </div>
          <Toaster position="top-center" richColors />
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
