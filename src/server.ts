import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// Storefront HTML is identical for every visitor (cart, wishlist and admin login all live
// in the browser), so the CDN can serve it without invoking a function. Vercel purges
// this cache on every deploy; s-maxage is stripped before the response reaches browsers.
const PUBLIC_PAGE_CACHE_CONTROL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
const UNCACHED_PATH_PREFIXES = ["/admin", "/auth", "/_serverFn", "/api"];

function withPublicPageCaching(request: Request, response: Response): Response {
  if (request.method !== "GET" || response.status !== 200) return response;
  if (response.headers.has("cache-control") || response.headers.has("set-cookie")) return response;

  const { pathname } = new URL(request.url);
  if (UNCACHED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xml|text\/plain/.test(contentType)) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", PUBLIC_PAGE_CACHE_CONTROL);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Scrapers known to ignore robots.txt. Turning them away here skips page rendering and
// database work; blocking them in the Vercel Firewall also avoids the request itself.
const BLOCKED_USER_AGENTS =
  /Bytespider|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|DataForSeoBot|BLEXBot|serpstatbot|MegaIndex|Barkrowler|GPTBot|CCBot|ClaudeBot|anthropic-ai|meta-externalagent|Amazonbot/i;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (BLOCKED_USER_AGENTS.test(request.headers.get("user-agent") ?? "")) {
      // no-store: the CDN cache isn't keyed on user agent, so a cached 403 would reach shoppers.
      return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withPublicPageCaching(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
