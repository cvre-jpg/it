import { createServerFn } from "@tanstack/react-start";

type LoginInput = {
  email: string;
  password: string;
};

type AccessCodeInput = {
  code: string;
};

export type AdminRole = "attendant" | "admin" | "super_admin";

export type AdminUser = {
  email: string;
  name: string;
  role: AdminRole;
  isAdmin: true;
};

type AdminUserProfileInput = {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: AdminRole;
  is_active: boolean;
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

async function syncBootstrapAdminUsers() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureAdminUsersTable();

  const bootstrapUsers = [
    {
      name: process.env.ADMIN_NAME || "Administrator",
      email: process.env.ADMIN_EMAIL || "admin@shopictgadgets.co.ke",
      password: process.env.ADMIN_PASSWORD || "changeme123",
      role: "admin" as const,
    },
    {
      name: process.env.SUPER_ADMIN_NAME || "Super Administrator",
      email: process.env.SUPER_ADMIN_EMAIL || "superadmin@shopictgadgets.co.ke",
      password: process.env.SUPER_ADMIN_PASSWORD || "superchange123",
      role: "super_admin" as const,
    },
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

const verifyAdminLoginServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as LoginInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  await syncBootstrapAdminUsers();

  const rows = await sql`
    select name, email, role
    from admin_users
    where lower(email) = ${email}
      and is_active = true
      and crypt(${password}, password_hash) = password_hash
    limit 1
  `;

  const user = rows[0];
  if (user) {
    return {
      email: String(user.email),
      name: String(user.name),
      role: normalizeAdminRole(user.role),
      isAdmin: true,
    } satisfies AdminUser;
  }

  throw new Error("Invalid admin credentials.");
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

const listAdminUsersServer = createServerFn({ method: "POST" }).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await syncBootstrapAdminUsers();

  const rows = await sql`
    select id, name, email, role, is_active, is_protected, source, created_at, updated_at
    from admin_users
    order by
      case when role = 'super_admin' then 0 else 1 end,
      created_at asc
  `;

  return rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: normalizeAdminRole(row.role),
    is_active: Boolean(row.is_active),
    is_protected: Boolean(row.is_protected),
    source: String(row.source ?? "manual"),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
}));
});

function normalizeAdminRole(value: unknown): AdminRole {
  if (value === "super_admin") return "super_admin";
  if (value === "attendant") return "attendant";
  return "admin";
}

const upsertAdminUserServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as AdminUserProfileInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await syncBootstrapAdminUsers();

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (!input.name.trim()) throw new Error("Name is required.");

  if (input.id) {
    const existingRows = await sql`
      select id, is_protected, password_hash
      from admin_users
      where id = ${input.id}
      limit 1
    `;
    const existing = existingRows[0];
    if (!existing) throw new Error("User profile not found.");

    if (input.password?.trim()) {
      await sql`
        update admin_users
        set
          name = ${input.name.trim()},
          email = ${email},
          role = ${input.role},
          is_active = ${input.is_active},
          password_hash = crypt(${input.password}, gen_salt('bf')),
          updated_at = now()
        where id = ${input.id}
      `;
    } else {
      await sql`
        update admin_users
        set
          name = ${input.name.trim()},
          email = ${email},
          role = ${input.role},
          is_active = ${input.is_active},
          updated_at = now()
        where id = ${input.id}
      `;
    }

    return { ok: true };
  }

  if (!input.password?.trim()) throw new Error("Password is required for a new admin profile.");

  await sql`
    insert into admin_users (name, email, password_hash, role, is_active, is_protected, source)
    values (
      ${input.name.trim()},
      ${email},
      crypt(${input.password}, gen_salt('bf')),
      ${input.role},
      ${input.is_active},
      false,
      'manual'
    )
  `;

  return { ok: true };
});

const setAdminUserActiveServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as { id: string; is_active: boolean };
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await syncBootstrapAdminUsers();

  const rows = await sql`
    select is_protected
    from admin_users
    where id = ${input.id}
    limit 1
  `;
  const user = rows[0];
  if (!user) throw new Error("User profile not found.");
  if (Boolean(user.is_protected) && !input.is_active) {
    throw new Error("Protected system admins cannot be deactivated.");
  }

  await sql`
    update admin_users
    set is_active = ${input.is_active}, updated_at = now()
    where id = ${input.id}
  `;
  return { ok: true };
});

const deleteAdminUserServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as { id: string };
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await syncBootstrapAdminUsers();

  const rows = await sql`
    select is_protected
    from admin_users
    where id = ${input.id}
    limit 1
  `;
  const user = rows[0];
  if (!user) throw new Error("User profile not found.");
  if (Boolean(user.is_protected)) {
    throw new Error("Protected system admins cannot be deleted.");
  }

  await sql`delete from admin_users where id = ${input.id}`;
  return { ok: true };
});

export async function verifyAdminLogin(email: string, password: string) {
  return verifyAdminLoginServer({ data: { email, password } }) as Promise<AdminUser>;
}

export async function getAdminAccessConfig() {
  return getAdminAccessConfigServer();
}

export async function verifyAdminAccessCode(code: string) {
  return verifyAdminAccessCodeServer({ data: { code } });
}

export async function listAdminUsers() {
  return listAdminUsersServer();
}

export async function upsertAdminUser(input: AdminUserProfileInput) {
  return upsertAdminUserServer({ data: input });
}

export async function setAdminUserActive(id: string, is_active: boolean) {
  return setAdminUserActiveServer({ data: { id, is_active } });
}

export async function deleteAdminUser(id: string) {
  return deleteAdminUserServer({ data: { id } });
}
