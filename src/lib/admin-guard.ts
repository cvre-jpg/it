import { createMiddleware } from "@tanstack/react-start";
import type { AdminUser } from "./admin-auth";

async function requireAdminSession(): Promise<AdminUser> {
  const [{ getCookie }, { ADMIN_SESSION_COOKIE, readAdminSessionToken }] = await Promise.all([
    import("./request.server"),
    import("./admin-session.server"),
  ]);

  const admin = await readAdminSessionToken(getCookie(ADMIN_SESSION_COOKIE));
  if (!admin) throw new Error("Unauthorized: please sign in again.");
  return admin;
}

// Requires a signed-in attendant.
export const adminOnly = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const admin = await requireAdminSession();
  return next({ context: { admin } });
});
