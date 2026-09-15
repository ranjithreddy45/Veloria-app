# Restoring a Veloria database backup

Backups are produced nightly by `scripts/vps-backup.sh` (cron: `scripts/vps-backup-cron.txt`)
as plain-SQL `pg_dump` output, gzipped:

```
/var/backups/veloria/veloria-YYYY-MM-DD.sql.gz     (date = IST)
```

Retention: the last **14 daily** files plus the **Sunday** file of each of the last **8 weeks**.
Dumps are taken with `--no-owner --no-privileges`, so they restore cleanly into any
role/database — objects end up owned by whichever role runs the restore.

> **Version rule.** `pg_dump`'s major version must be **>= the server's** and `psql`
> should match the target. The backup uses `postgres:16-alpine` by default (`PG_IMAGE`
> in `.env.production`). If the Neon project runs PG 17, set `PG_IMAGE=postgres:17-alpine`
> and use `postgres:17-alpine` below as well.

---

## 0. Pick and verify a backup (on the VPS)

```bash
ls -lh /var/backups/veloria/
tail -n 20 /var/log/veloria-backup.log

F=/var/backups/veloria/veloria-2026-09-14.sql.gz
gzip -t "$F" && echo "gzip OK"
gzip -dc "$F" | tail -n 3          # must end with: -- PostgreSQL database dump complete
gzip -dc "$F" | grep -c '^CREATE TABLE'   # sanity: a few hundred tables
```

Copy it off the box if you are restoring elsewhere:

```bash
scp billionevents:/var/backups/veloria/veloria-2026-09-14.sql.gz ~/Desktop/
```

---

## 1. Restore into a fresh Neon branch (recommended)

Never restore over `main` directly. Restore into a **new branch**, check it, then either
point the app at it or promote it.

### 1a. Create the target

Neon console → project → **Branches → Create branch**
* Parent: `main`, name `restore-2026-09-14`
* Data: **"Empty"** if offered; otherwise a normal copy is fine — you will create a *new
  database* on it in the next step, so the parent's tables are untouched.

Or with the CLI (`npm i -g neonctl`, `neonctl auth`):

```bash
neonctl branches create --name restore-2026-09-14 --parent main
```

On that branch create an **empty database** so the restore cannot collide with existing
tables, and grab its **direct (non-pooled)** connection string:

```bash
neonctl databases create --branch restore-2026-09-14 --name veloria_restore
TARGET="$(neonctl connection-string restore-2026-09-14 --database-name veloria_restore)"
# → postgresql://…@ep-…-<id>.<region>.aws.neon.tech/veloria_restore?sslmode=require
#   (must NOT contain "-pooler." — the pooler cannot run a large transactional restore)
```

### 1b. Load the dump

On the VPS (Docker, host network — the same way the backup ran):

```bash
export TARGET   # the direct URL from above; keep it out of shell history if you can
gzip -dc /var/backups/veloria/veloria-2026-09-14.sql.gz \
  | docker run --rm -i --network host -e TARGET postgres:16-alpine \
      sh -c 'exec psql "$TARGET" -v ON_ERROR_STOP=1 --single-transaction --quiet'
echo "exit=$?"    # 0 = every statement applied
```

From a Mac with `psql` installed (`brew install libpq`):

```bash
gzip -dc ~/Desktop/veloria-2026-09-14.sql.gz \
  | psql "$TARGET" -v ON_ERROR_STOP=1 --single-transaction --quiet
```

Known-harmless noise on Neon: `SET transaction_timeout` (only from a PG17 dump into PG16)
and `COMMENT ON EXTENSION` "must be owner" warnings. With `ON_ERROR_STOP=1` a real error
aborts and rolls back the whole transaction, so a non-zero exit means **nothing** was
written — fix the cause and rerun.

### 1c. Check it

```bash
psql "$TARGET" -c '\dt' | wc -l
psql "$TARGET" -c 'select count(*) from "User"'
psql "$TARGET" -c 'select count(*), max("createdAt") from "Booking"'
psql "$TARGET" -c 'select lane, status, "createdAt" from "CronRunLog" order by "createdAt" desc limit 3'
```

### 1d. Put it in service

Either point the app at the restored database — in `/opt/veloria/.env.production` set
`DATABASE_URL` (pooled URL of the branch/database) and `DATABASE_URL_UNPOOLED` (direct),
then `docker compose -f /opt/veloria/docker-compose.prod.yml up -d app` — or in the Neon
console **set the restored branch as primary** / use *Restore* to replace `main` with it.
Take a fresh backup right afterwards (`/opt/veloria/scripts/vps-backup.sh`).

The app's schema is managed with `prisma db push` at deploy time; the dump already
contains the full schema, so **do not** run `db push` before checking the data — it would
only be needed if you restore an older dump into a newer build.

---

## 2. Restore into local Postgres (inspection / dev)

```bash
docker run -d --name veloria-pg -e POSTGRES_PASSWORD=veloria -p 5433:5432 postgres:16-alpine
sleep 5
docker exec veloria-pg createdb -U postgres veloria_restore
gzip -dc ~/Desktop/veloria-2026-09-14.sql.gz \
  | docker exec -i veloria-pg psql -U postgres -d veloria_restore -v ON_ERROR_STOP=1 --single-transaction --quiet
docker exec -it veloria-pg psql -U postgres -d veloria_restore -c 'select count(*) from "Booking"'
```

Point a local checkout at it with `DATABASE_URL="postgresql://postgres:veloria@localhost:5433/veloria_restore"`.
Clean up: `docker rm -f veloria-pg`.

---

## 3. Restoring a single table

Extract just the statements for one table from the plain dump instead of loading everything:

```bash
gzip -dc veloria-2026-09-14.sql.gz \
  | awk '/^COPY public."Payment" /,/^\\\.$/' > payment-rows.sql    # data only
psql "$TARGET" -c 'truncate "Payment"' && psql "$TARGET" -f payment-rows.sql
```

(For a table with foreign keys, load into a scratch database as in section 2 and copy the
rows you need with `INSERT … SELECT` over `dblink`/`postgres_fdw`, or via CSV.)

---

## 4. Test the whole loop quarterly

1. Pick the latest backup, run section 1 into a throwaway branch.
2. Compare row counts of `User`, `Booking`, `Invoice`, `Payment` with production.
3. Delete the branch: `neonctl branches delete restore-2026-09-14`.

If step 1 fails, the backups are not backups.
