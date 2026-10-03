import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

// All queries in the app use the tagged-template form (sql`...`), which both drivers
// support with the same parameter handling, so callers don't care which one is active.
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing database connection string. Set DATABASE_URL.");
  }

  return databaseUrl;
}

function isNeonUrl(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createPostgresSql(databaseUrl: string): SqlTag {
  const hostname = new URL(databaseUrl).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  // Built for Supabase's transaction pooler (port 6543): it doesn't support prepared
  // statements, and serverless instances should hold only a few short-lived connections.
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocal ? false : "require",
  });

  return (strings, ...values) => client(strings, ...(values as any[])) as unknown as Promise<any[]>;
}

let _sql: SqlTag | undefined;

export function getNeonSql(): SqlTag {
  if (!_sql) {
    const databaseUrl = getDatabaseUrl();
    _sql = isNeonUrl(databaseUrl)
      ? (neon(databaseUrl) as unknown as SqlTag)
      : createPostgresSql(databaseUrl);
  }
  return _sql;
}
