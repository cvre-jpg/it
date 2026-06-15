import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Missing Neon database connection string. Set DATABASE_URL or NEON_DATABASE_URL.",
    );
  }

  return databaseUrl;
}

let _sql: ReturnType<typeof neon> | undefined;

export function getNeonSql() {
  if (!_sql) _sql = neon(getDatabaseUrl());
  return _sql;
}
