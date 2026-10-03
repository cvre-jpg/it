# Moving from Neon to Supabase (free) without losing data

Neon stays untouched the whole time. The site keeps running on Neon until step 5,
and step 5 can be undone in a minute.

**Do not add or edit products in the admin between step 1 and step 5.**

All commands are for PowerShell, run from the project folder.

## 0. One-time setup

- Create a free project at https://supabase.com. Save the database password.
- In Supabase, go to **Connect** and copy two connection strings:
  - **Session pooler** (port `5432`). Used for the restore in step 3.
  - **Transaction pooler** (port `6543`). Used by the website in step 5.
- In Neon, copy the connection string **without** `-pooler` in the hostname.
- Install the PostgreSQL 17 client tools (they provide `pg_dump` and `psql`):
  `winget install PostgreSQL.PostgreSQL.17`, then open a new terminal.

## 1. Safety backup (read-only)

```powershell
$env:SOURCE_DATABASE_URL = "<neon url>"
npm run db:backup
```

This writes every table to `backups/<date>/*.json` and prints row counts. Keep this folder.

## 2. Full dump from Neon (read-only)

```powershell
pg_dump "<neon url>" --no-owner --no-privileges --schema=public -f neon-dump.sql
```

## 3. Restore into Supabase

```powershell
psql "<supabase session pooler url>" -v ON_ERROR_STOP=0 -f neon-dump.sql
```

You can ignore errors such as `schema "public" already exists` or `extension ... already exists`.

## 4. Verify that everything copied (read-only)

```powershell
$env:SOURCE_DATABASE_URL = "<neon url>"
$env:TARGET_DATABASE_URL = "<supabase session pooler url>"
npm run db:verify
```

It must end with `OK: every table and product matches.` If it doesn't, stop and don't do step 5.

## 5. Switch the website

In Vercel, go to **Settings → Environment Variables** and do the following:

- Set `DATABASE_URL` to the Supabase **transaction pooler** URL (port `6543`).
- Add `ADMIN_SESSION_SECRET` with a long random value. To generate one:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Then redeploy. Open the shop, a few products and the admin to check everything.

**To undo:** set `DATABASE_URL` back to the Neon URL and redeploy.

## 6. Keep Neon for 2–3 weeks

Keep Neon as a second backup for a few weeks before deleting the project.
