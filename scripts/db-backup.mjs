// Read-only safety backup: writes every table in the public schema to JSON files.
// It never modifies the database.
//
//   SOURCE_DATABASE_URL="postgres://..." node scripts/db-backup.mjs
//
// Output: backups/<timestamp>/<table>.json plus _summary.json with row counts.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set SOURCE_DATABASE_URL (or DATABASE_URL) to the database you want to back up.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
const outDir = path.join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outDir, { recursive: true });

try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;

  const summary = {};
  for (const { table_name: table } of tables) {
    const rows = await sql`select * from ${sql(table)}`;
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    console.log(`${table.padEnd(36)} ${rows.length} rows`);
  }

  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nBackup written to ${outDir}`);
} finally {
  await sql.end();
}
