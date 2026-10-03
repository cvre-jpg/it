// Static named imports on purpose: a dynamic import of "@tanstack/react-start/server" makes the
// bundler emit a full namespace object for it, which breaks the SSR build. Callers in shared
// files dynamically import this module instead, like neon.server.ts.
export {
  deleteCookie,
  getCookie,
  getRequestIP,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";
