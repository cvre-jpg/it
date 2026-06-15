import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const QUERY_STALE_TIME = 1000 * 60 * 10;
const QUERY_GC_TIME = 1000 * 60 * 60;
const QUERY_CACHE_STORAGE_KEY = "shop-ict-query-cache-v3";
const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60;

function safeReadLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage permission and quota issues.
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage permission and quota issues.
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        gcTime: QUERY_GC_TIME,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function restorePersistedQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  try {
    const raw = safeReadLocalStorage(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as { timestamp?: number; clientState?: unknown };
    if (!parsed.timestamp || !parsed.clientState) return;

    if (Date.now() - parsed.timestamp > QUERY_CACHE_MAX_AGE) {
      safeRemoveLocalStorage(QUERY_CACHE_STORAGE_KEY);
      return;
    }

    hydrate(queryClient, parsed.clientState);
  } catch {
    safeRemoveLocalStorage(QUERY_CACHE_STORAGE_KEY);
  }
}

function persistQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  const persist = () => {
    try {
      const clientState = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === "success",
      });

      safeWriteLocalStorage(
        QUERY_CACHE_STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          clientState,
        }),
      );
    } catch {
      // Ignore serialization issues.
    }
  };

  persist();
  queryClient.getQueryCache().subscribe(persist);
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  restorePersistedQueryCache(queryClient);
  persistQueryCache(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
