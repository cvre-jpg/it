import { createMiddleware } from "@tanstack/react-start";

// Lets the CDN answer repeated storefront reads (same URL + query) without running a
// function. Only safe for GET server functions that return the same data to everyone.
const PUBLIC_DATA_CACHE_CONTROL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

export const publicCache = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const result = await next();
  const { setResponseHeader } = await import("./request.server");
  setResponseHeader("Cache-Control", PUBLIC_DATA_CACHE_CONTROL);
  return result;
});
