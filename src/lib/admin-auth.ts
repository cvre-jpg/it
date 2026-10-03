import { createServerFn } from "@tanstack/react-start";

type LoginInput = {
  email: string;
  password: string;
};

type AccessCodeInput = {
  code: string;
};

// The admin area has a single role: attendants who list and manage products and the catalogue.
export type AdminRole = "attendant";

export type AdminUser = {
  email: string;
  name: string;
  role: AdminRole;
  isAdmin: true;
};

async function ensureAdminUsersTable() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists admin_users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null,
      is_active boolean not null default true,
      is_protected boolean not null default false,
      source text not null default 'manual',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

// Bootstrap users come from env vars, which only change on redeploy, so syncing once
// per server instance is enough (each sync runs several bcrypt hashes in the database).
let bootstrapAdminUsersReady: Promise<void> | undefined;

function syncBootstrapAdminUsers() {
  if (!bootstrapAdminUsersReady) {
    bootstrapAdminUsersReady = upsertBootstrapAdminUsers().catch((error) => {
      bootstrapAdminUsersReady = undefined;
      throw error;
    });
  }
  return bootstrapAdminUsersReady;
}

async function upsertBootstrapAdminUsers() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureAdminUsersTable();

  const bootstrapUsers = [
    {
      name: process.env.ATTENDANT_NAME || "Attendant",
      email: process.env.ATTENDANT_EMAIL || "attendant@shopictgadgets.co.ke",
      password: process.env.ATTENDANT_PASSWORD || "changeme123",
      role: "attendant" as const,
    },
  ];

  for (const user of bootstrapUsers) {
    await sql`
      insert into admin_users (name, email, password_hash, role, is_active, is_protected, source)
      values (
        ${user.name},
        ${user.email.toLowerCase()},
        crypt(${user.password}, gen_salt('bf')),
        ${user.role},
        true,
        true,
        'environment'
      )
      on conflict (email)
      do update set
        name = excluded.name,
        role = excluded.role,
        is_active = true,
        is_protected = true,
        source = 'environment',
        password_hash = case
          when crypt(${user.password}, admin_users.password_hash) = admin_users.password_hash
            then admin_users.password_hash
          else crypt(${user.password}, gen_salt('bf'))
        end,
        updated_at = now()
    `;
  }
}

// Best-effort brute-force throttle. It is per server instance, so it slows attackers
// down rather than being a hard global limit.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function isLoginThrottled(key: string) {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key: string) {
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    loginFailures.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

const verifyAdminLoginServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as LoginInput;
  const { getNeonSql } = await import("./neon.server");
  const { getRequestIP, setCookie } = await import("./request.server");
  const { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSessionToken } = await import(
    "./admin-session.server"
  );
  const sql = getNeonSql();

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const throttleKey = `${getRequestIP({ xForwardedFor: true }) ?? "unknown"}:${email}`;

  if (isLoginThrottled(throttleKey)) {
    throw new Error("Too many failed attempts. Try again in 15 minutes.");
  }

  await syncBootstrapAdminUsers();

  const rows = await sql`
    select name, email, role
    from admin_users
    where lower(email) = ${email}
      and is_active = true
      and role = 'attendant'
      and crypt(${password}, password_hash) = password_hash
    limit 1
  `;

  const user = rows[0];
  if (user) {
    loginFailures.delete(throttleKey);
    const adminUser = {
      email: String(user.email),
      name: String(user.name),
      role: "attendant",
      isAdmin: true,
    } satisfies AdminUser;

    setCookie(ADMIN_SESSION_COOKIE, await createAdminSessionToken(adminUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

    return adminUser;
  }

  recordLoginFailure(throttleKey);
  throw new Error("Invalid admin credentials.");
});

// Returns the signed-in admin from the httpOnly cookie, or null.
const getAdminSessionServer = createServerFn({ method: "POST" }).handler(async () => {
  const { getCookie } = await import("./request.server");
  const { ADMIN_SESSION_COOKIE, readAdminSessionToken } = await import("./admin-session.server");
  return readAdminSessionToken(getCookie(ADMIN_SESSION_COOKIE));
});

const signOutAdminServer = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await import("./request.server");
  const { ADMIN_SESSION_COOKIE } = await import("./admin-session.server");
  deleteCookie(ADMIN_SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

const getAdminAccessConfigServer = createServerFn({ method: "GET" }).handler(async () => {
  const configuredCode = process.env.ADMIN_ACCESS_CODE?.trim() ?? "";

  return {
    enabled: configuredCode.length > 0,
  };
});

const verifyAdminAccessCodeServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as AccessCodeInput;
  const configuredCode = process.env.ADMIN_ACCESS_CODE?.trim() ?? "";

  if (!configuredCode) {
    return {
      enabled: false,
      valid: true,
    };
  }

  return {
    enabled: true,
    valid: input.code.trim() === configuredCode,
  };
});

export async function verifyAdminLogin(email: string, password: string) {
  return verifyAdminLoginServer({ data: { email, password } }) as Promise<AdminUser>;
}

export async function getAdminSession() {
  return getAdminSessionServer() as Promise<AdminUser | null>;
}

export async function signOutAdmin() {
  return signOutAdminServer();
}

export async function getAdminAccessConfig() {
  return getAdminAccessConfigServer();
}

export async function verifyAdminAccessCode(code: string) {
  return verifyAdminAccessCodeServer({ data: { code } });
}


