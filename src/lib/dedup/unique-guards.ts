// ============================================================
// Database unique guards — hard, DB-level duplicate protection.
// ------------------------------------------------------------
// Each guard is a PARTIAL, EXPRESSION-based UNIQUE index on the same
// normalised natural key the app-level dedup layer (src/lib/dedup.ts) compares
// on, so "+91 98765 43210" / "9876543210" / "098765 43210" collide, and
// "A@B.com" == "a@b.com". Soft-deleted / archived rows are excluded by the
// partial predicate so a merged-away or trashed record can never block a
// re-creation (the merge tool soft-deletes losers for exactly this reason).
//
// These live HERE, not in schema.prisma, on purpose: a @unique on a table
// that already holds duplicates makes `prisma db push` fail on production and
// blocks every deploy. Partial/expression indexes are not representable in
// the Prisma schema, so `db push` neither creates nor (per Prisma's
// describer, which skips indexes it cannot model) drops them. A guard is only
// applied once its table is clean (duplicate groups = 0); bootstrap re-checks
// on every deploy and the admin can apply from /settings/duplicates.
//
// This file is deliberately dependency-free (no "@/" imports, no Prisma) so
// prisma/bootstrap.ts can import it with a relative path under tsx.
//
// All SQL here is built from the CONSTANTS below only — never from user input.
// ============================================================

export type UniqueGuardKey = "phone" | "email";

export interface UniqueGuard {
  /** Stable machine name (ActivityLog entityId, action argument). */
  name: string;
  /** Human label for the settings UI. */
  label: string;
  /** Postgres table name (Prisma model name — no @@map in this schema). */
  table: string;
  keyType: UniqueGuardKey;
  /** Immutable SQL expression that yields the normalised key for one row. */
  expression: string;
  /** Partial predicate: which rows the uniqueness applies to. */
  where: string;
  /** Index name. Deliberately NOT the `<Table>_<col>_key` shape Prisma would
   *  mint for a future @unique, so the two can never collide. */
  indexName: string;
  /**
   * Whether bootstrap may create the index on its own once the table is clean.
   * false = status-only in bootstrap; an admin applies it deliberately.
   *
   * Contact is false because several customer-facing create paths (public
   * configurator advance, public hold, one-tap booking, widget, webforms,
   * referrals, AI tools) still resolve an existing contact with an EXACT
   * string match on phone/email before creating. Lead-capture stores E.164
   * ("+9198…"); a returning customer typing "98…" misses that lookup and the
   * flow creates a second contact — today a silent duplicate, but under this
   * index a P2002 that would fail a paid booking flow. Those sites should use
   * the normalised lookup (coarseContactWhere + matchesContactKey) before the
   * Contact guards go on automatically.
   */
  autoApply: boolean;
}

// ------------------------------------------------------------
// Key expressions
// ------------------------------------------------------------
// Digits only. `[^0-9]` (not `\D`) so the SQL never depends on the server's
// standard_conforming_strings setting for a backslash escape.
const DIGITS = (col: string) => `regexp_replace("${col}", '[^0-9]', '', 'g')`;

/**
 * Country-aware phone key. Mirrors src/lib/dedup.ts `phoneDigits` (last 10
 * digits for the +91 / leading-0 / spacing variants of one Indian number) but
 * keeps a stated foreign country code, matching the COUNTRY GUARD in
 * src/lib/lead-capture.ts: "+1 415 555 2671" and "+91 415 555 2671" are two
 * people and must NOT collide even though their last 10 digits are equal.
 *
 *   "9876543210"        -> 919876543210   (bare 10 digits: assumed India)
 *   "09876543210"       -> 919876543210   (trunk 0 + 10 digits)
 *   "+91 98765 43210"   -> 919876543210
 *   "91 98765 43210"    -> 919876543210
 *   "+1 415 555 2671"   -> 14155552671
 *   "+44 20 7946 0958"  -> 442079460958
 *
 * Every group this key forms is also a group in the /settings/duplicates
 * finder (which compares the last 10 digits); the reverse is not true for the
 * cross-country case — by design.
 */
function phoneKeyExpression(col: string): string {
  const d = DIGITS(col);
  return (
    `CASE ` +
    `WHEN length(${d}) = 10 THEN '91' || ${d} ` +
    `WHEN length(${d}) = 11 AND left(${d}, 1) = '0' THEN '91' || right(${d}, 10) ` +
    `ELSE ${d} END`
  );
}

/** Lowercased, trimmed email — mirrors `normalizeEmail`. */
function emailKeyExpression(col: string): string {
  return `lower(btrim("${col}"))`;
}

/** Rows that carry a usable phone (at least one digit) and are live. */
function phoneWhere(col: string, live: string): string {
  return `"${col}" IS NOT NULL AND ${DIGITS(col)} <> '' AND ${live}`;
}

/** Rows that carry a non-blank email and are live. */
function emailWhere(col: string, live: string): string {
  return `"${col}" IS NOT NULL AND btrim("${col}") <> '' AND ${live}`;
}

// ------------------------------------------------------------
// The guards
// ------------------------------------------------------------
// Soft-delete columns: Contact.deletedAt, HallOwner.deletedAt (DateTime?),
// Vendor.isArchived (Boolean). Venue is deliberately NOT guarded: it has no
// city column, and src/lib/acq/venue-bridge.ts mints a Venue named after each
// won BD property without a name check — same-name properties in different
// cities are legitimately distinct venues, so a name-only unique would fail a
// deal-won transaction. User.email is already @unique in the schema.
export const GUARDS: readonly UniqueGuard[] = [
  {
    name: "contact_phone",
    label: "Contacts — phone",
    table: "Contact",
    keyType: "phone",
    expression: phoneKeyExpression("phone"),
    where: phoneWhere("phone", `"deletedAt" IS NULL`),
    indexName: "Contact_phone_norm_uniq",
    autoApply: false,
  },
  {
    name: "contact_email",
    label: "Contacts — email",
    table: "Contact",
    keyType: "email",
    expression: emailKeyExpression("email"),
    where: emailWhere("email", `"deletedAt" IS NULL`),
    indexName: "Contact_email_lower_uniq",
    autoApply: false,
  },
  {
    name: "vendor_phone",
    label: "Vendors — phone",
    table: "Vendor",
    keyType: "phone",
    expression: phoneKeyExpression("phone"),
    where: phoneWhere("phone", `"isArchived" = false`),
    indexName: "Vendor_phone_norm_uniq",
    autoApply: true,
  },
  {
    name: "vendor_email",
    label: "Vendors — email",
    table: "Vendor",
    keyType: "email",
    expression: emailKeyExpression("email"),
    where: emailWhere("email", `"isArchived" = false`),
    indexName: "Vendor_email_lower_uniq",
    autoApply: true,
  },
  {
    name: "hall_owner_phone",
    label: "Hall owners — phone",
    table: "HallOwner",
    keyType: "phone",
    expression: phoneKeyExpression("phone"),
    where: phoneWhere("phone", `"deletedAt" IS NULL`),
    indexName: "HallOwner_phone_norm_uniq",
    autoApply: true,
  },
  {
    name: "hall_owner_email",
    label: "Hall owners — email",
    table: "HallOwner",
    keyType: "email",
    expression: emailKeyExpression("email"),
    where: emailWhere("email", `"deletedAt" IS NULL`),
    indexName: "HallOwner_email_lower_uniq",
    autoApply: true,
  },
];

/** Look a guard up by its stable name; null for anything not in the list, so
 *  callers can never feed a caller-supplied string into SQL. */
export function findGuard(name: string): UniqueGuard | null {
  return GUARDS.find((g) => g.name === name) ?? null;
}

// ------------------------------------------------------------
// SQL builders (constant SQL only)
// ------------------------------------------------------------

/** Number of distinct keys held by MORE than one live row. Returns one row
 *  `{ groups: number }` (int-cast so Prisma yields a JS number, not a BigInt). */
export function duplicateCountSql(guard: UniqueGuard): string {
  return (
    `SELECT count(*)::int AS "groups" FROM (` +
    `SELECT 1 FROM "${guard.table}" WHERE ${guard.where} ` +
    `GROUP BY (${guard.expression}) HAVING count(*) > 1` +
    `) AS d`
  );
}

/** Up to `limit` duplicate keys, largest groups first: `{ key, count }[]`. */
export function duplicateSampleSql(guard: UniqueGuard, limit = 5): string {
  const n = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 5;
  return (
    `SELECT (${guard.expression}) AS "key", count(*)::int AS "count" ` +
    `FROM "${guard.table}" WHERE ${guard.where} ` +
    `GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC, 1 ASC LIMIT ${n}`
  );
}

/**
 * Creates the guard. CONCURRENTLY builds without blocking writes but CANNOT
 * run inside a transaction block — issue it as a single autocommit statement
 * (`prisma.$executeRawUnsafe`, never within `$transaction`). If the build
 * fails part-way (e.g. a duplicate is inserted mid-build) Postgres leaves an
 * INVALID index behind, which IF NOT EXISTS would then keep forever — check
 * `indexStatusSql` first and drop an invalid one with `dropIndexSql`.
 */
export function createIndexSql(guard: UniqueGuard): string {
  return (
    `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "${guard.indexName}" ` +
    `ON "${guard.table}" ((${guard.expression})) WHERE ${guard.where}`
  );
}

/** Drops the guard's index (used to clear an INVALID leftover before a retry). */
export function dropIndexSql(guard: UniqueGuard): string {
  return `DROP INDEX CONCURRENTLY IF EXISTS "${guard.indexName}"`;
}

/**
 * Does the index exist, and is it valid? Returns zero rows when absent, else
 * one row `{ valid: boolean }`. Reads pg_index (the catalog behind pg_indexes)
 * because only it exposes `indisvalid`, which distinguishes a finished guard
 * from the invalid husk a failed CONCURRENTLY build leaves behind.
 */
export function indexStatusSql(guard: UniqueGuard): string {
  return (
    `SELECT i.indisvalid AS "valid" FROM pg_index i ` +
    `JOIN pg_class c ON c.oid = i.indexrelid ` +
    `JOIN pg_namespace n ON n.oid = c.relnamespace ` +
    `WHERE n.nspname = current_schema() AND c.relname = '${guard.indexName}'`
  );
}
