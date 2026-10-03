import type { AdminRole, AdminUser } from "./admin-auth";

export const ADMIN_SESSION_COOKIE = "shopict_admin";
export const ADMIN_SESSION_TTL_SECONDS = 5 * 24 * 60 * 60;

type SessionPayload = {
  email: string;
  name: string;
  role: AdminRole;
  exp: number;
};

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret) return secret;

  // Fall back to the database URL (already a server-only secret) so a missing env var
  // doesn't lock everyone out. Setting ADMIN_SESSION_SECRET is still recommended.
  const fallback = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!fallback) throw new Error("Missing ADMIN_SESSION_SECRET.");
  return `shopict-admin-session:${fallback}`;
}

function getSigningKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(getSessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function createAdminSessionToken(user: AdminUser) {
  const payload: SessionPayload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function readAdminSessionToken(token: string | undefined | null): Promise<AdminUser | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!payload.email || typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    if (payload.role !== "attendant") return null;

    return { email: payload.email, name: payload.name, role: "attendant", isAdmin: true };
  } catch {
    return null;
  }
}
