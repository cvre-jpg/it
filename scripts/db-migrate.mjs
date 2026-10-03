// Copies every table in the public schema from the old database (Neon) to the new one
// (Supabase): table definitions, rows, sequences, indexes and keys. Read-only on the source.
//
//   SOURCE_DATABASE_URL="<neon url>" TARGET_DATABASE_URL="<supabase url>" node scripts/db-migrate.mjs
//
// Refuses to run if any of the tables already contain rows in the target, so it can never
// create duplicates. Run scripts/db-verify.mjs afterwards.
import postgres from "postgres";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Set SOURCE_DATABASE_URL (old) and TARGET_DATABASE_URL (new).");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are the same database.");
  process.exit(1);
}

const source = postgres(sourceUrl, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
const target = postgres(targetUrl, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
const BATCH_SIZE = 500;

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function listTables() {
  const rows = await source`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;
  return rows.map((row) => row.name);
}

async function describeTable(table) {
  const columns = await source`
    select a.attname as name,
           format_type(a.atttypid, a.atttypmod) as type,
           a.attnotnull as not_null,
           a.attidentity as identity,
           a.attgenerated as generated,
           pg_get_expr(d.adbin, d.adrelid) as default_expr
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = ${`public.${quoteIdent(table)}`}::regclass and a.attnum > 0 and not a.attisdropped
    order by a.attnum
  `;
  const constraints = await source`
    select conname as name, contype as type, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = ${`public.${quoteIdent(table)}`}::regclass
    order by contype, conname
  `;
  const indexes = await source`
    select i.indexname as name, i.indexdef as definition
    from pg_indexes i
    where i.schemaname = 'public' and i.tablename = ${table}
      and not exists (select 1 from pg_constraint c where c.conname = i.indexname)
  `;
  return { columns, constraints, indexes };
}

function sequenceNames(columns) {
  return columns
    .map((column) => column.default_expr?.match(/nextval\('([^']+)'::regclass\)/)?.[1])
    .filter(Boolean);
}

async function main() {
  await target`create extension if not exists pgcrypto`;

  const tables = await listTables();
  const definitions = new Map();
  for (const table of tables) definitions.set(table, await describeTable(table));

  // Safety: never write into tables that already hold data.
  for (const table of tables) {
    const [{ exists }] = await target`select to_regclass(${`public.${quoteIdent(table)}`}) is not null as exists`;
    if (!exists) continue;
    const [{ count }] = await target`select count(*)::int as count from ${target(table)}`;
    if (count > 0) {
      throw new Error(`Target table "${table}" already has ${count} rows. Aborting so nothing is duplicated.`);
    }
  }

  // 1. Sequences and tables (columns, defaults, NOT NULL), then primary/unique/check keys.
  for (const table of tables) {
    const { columns, constraints } = definitions.get(table);
    for (const sequence of sequenceNames(columns)) {
      await target.unsafe(`create sequence if not exists ${sequence}`);
    }

    const columnSql = columns.map((column) => {
      let line = `${quoteIdent(column.name)} ${column.type}`;
      if (column.generated === "s") {
        line += ` generated always as (${column.default_expr}) stored`;
      } else if (column.identity) {
        line += ` generated ${column.identity === "a" ? "always" : "by default"} as identity`;
      } else if (column.default_expr) {
        line += ` default ${column.default_expr}`;
      }
      if (column.not_null) line += " not null";
      return line;
    });
    await target.unsafe(`create table if not exists public.${quoteIdent(table)} (\n  ${columnSql.join(",\n  ")}\n)`);

    for (const constraint of constraints.filter((c) => c.type !== "f")) {
      const [{ exists }] = await target`
        select exists (select 1 from pg_constraint where conname = ${constraint.name}
          and conrelid = ${`public.${quoteIdent(table)}`}::regclass) as exists
      `;
      if (!exists) {
        await target.unsafe(
          `alter table public.${quoteIdent(table)} add constraint ${quoteIdent(constraint.name)} ${constraint.definition}`,
        );
      }
    }
    console.log(`created  ${table}`);
  }

  // 2. Rows. Postgres produces the JSON on the source and parses it on the target, so every
  //    value (jsonb, arrays, timestamps, numerics) keeps its exact type and precision.
  for (const table of tables) {
    const { columns } = definitions.get(table);
    const insertable = columns.filter((column) => column.generated !== "s").map((column) => quoteIdent(column.name));
    const hasIdentity = columns.some((column) => column.identity === "a");
    const [{ count }] = await source`select count(*)::int as count from ${source(table)}`;

    for (let offset = 0; offset < count; offset += BATCH_SIZE) {
      const [{ data }] = await source.unsafe(
        `select coalesce(json_agg(t), '[]'::json)::text as data
         from (select * from public.${quoteIdent(table)} order by 1 limit ${BATCH_SIZE} offset ${offset}) t`,
      );
      await target.unsafe(
        `insert into public.${quoteIdent(table)} (${insertable.join(", ")})
         ${hasIdentity ? "overriding system value" : ""}
         select ${insertable.join(", ")} from json_populate_recordset(null::public.${quoteIdent(table)}, ($1::text)::json)`,
        [data],
      );
    }
    console.log(`copied   ${table.padEnd(34)} ${count} rows`);
  }

  // 3. Move sequences past the copied ids so new rows don't collide.
  for (const table of tables) {
    const { columns } = definitions.get(table);
    for (const column of columns) {
      const sequence = column.default_expr?.match(/nextval\('([^']+)'::regclass\)/)?.[1];
      if (!sequence) continue;
      await target.unsafe(
        `select setval('${sequence}', coalesce((select max(${quoteIdent(column.name)}) from public.${quoteIdent(table)}), 0) + 1, false)`,
      );
    }
    for (const column of columns.filter((c) => c.identity)) {
      await target.unsafe(
        `select setval(pg_get_serial_sequence('public.${quoteIdent(table)}', '${column.name}'),
                coalesce((select max(${quoteIdent(column.name)}) from public.${quoteIdent(table)}), 0) + 1, false)`,
      );
    }
  }

  // 4. Indexes and foreign keys (after the data, so load order doesn't matter).
  for (const table of tables) {
    const { constraints, indexes } = definitions.get(table);
    for (const index of indexes) {
      await target.unsafe(index.definition.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS "));
    }
    for (const constraint of constraints.filter((c) => c.type === "f")) {
      const [{ exists }] = await target`
        select exists (select 1 from pg_constraint where conname = ${constraint.name}
          and conrelid = ${`public.${quoteIdent(table)}`}::regclass) as exists
      `;
      if (!exists) {
        await target.unsafe(
          `alter table public.${quoteIdent(table)} add constraint ${quoteIdent(constraint.name)} ${constraint.definition}`,
        );
      }
    }
  }

  // 5. Supabase publishes the public schema through its web API. Row Level Security with no
  //    policies closes that door; the website connects as the table owner, which bypasses RLS.
  for (const table of tables) {
    await target.unsafe(`alter table public.${quoteIdent(table)} enable row level security`);
  }

  console.log("\nDone. Now run: node scripts/db-verify.mjs");
}

try {
  await main();
} catch (error) {
  console.error(`\nMigration stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all([source.end(), target.end()]);
}
