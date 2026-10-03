// Read-only check that a migration copied everything: compares row counts for every table,
// plus product slugs, between the old and new database. It never modifies either one.
//
//   SOURCE_DATABASE_URL="<neon url>" TARGET_DATABASE_URL="<supabase url>" node scripts/db-verify.mjs
import postgres from "postgres";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Set both SOURCE_DATABASE_URL (old) and TARGET_DATABASE_URL (new).");
  process.exit(1);
}

const source = postgres(sourceUrl, { ssl: "require", max: 1, prepare: false });
const target = postgres(targetUrl, { ssl: "require", max: 1, prepare: false });

async function tableCounts(sql) {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const counts = {};
  for (const { table_name: table } of tables) {
    const [{ count }] = await sql`select count(*)::int as count from ${sql(table)}`;
    counts[table] = count;
  }
  return counts;
}

try {
  const [sourceCounts, targetCounts] = await Promise.all([tableCounts(source), tableCounts(target)]);
  let problems = 0;

  console.log(`${"table".padEnd(36)} ${"old".padStart(8)} ${"new".padStart(8)}`);
  for (const table of Object.keys(sourceCounts)) {
    const before = sourceCounts[table];
    const after = targetCounts[table];
    const ok = before === after;
    if (!ok) problems += 1;
    console.log(`${table.padEnd(36)} ${String(before).padStart(8)} ${String(after ?? "MISSING").padStart(8)}${ok ? "" : "   <-- MISMATCH"}`);
  }

  const [sourceSlugs, targetSlugs] = await Promise.all([
    source`select slug from products order by slug`,
    target`select slug from products order by slug`,
  ]);
  const targetSlugSet = new Set(targetSlugs.map((row) => row.slug));
  const missing = sourceSlugs.filter((row) => !targetSlugSet.has(row.slug));
  if (missing.length > 0) {
    problems += 1;
    console.log(`\nProducts missing in new database: ${missing.map((row) => row.slug).join(", ")}`);
  }

  console.log(problems === 0 ? "\nOK: every table and product matches." : `\n${problems} problem(s) found. Do NOT switch DATABASE_URL yet.`);
  process.exitCode = problems === 0 ? 0 : 1;
} finally {
  await Promise.all([source.end(), target.end()]);
}
