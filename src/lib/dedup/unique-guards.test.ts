import { describe, expect, it } from "vitest";
import {
  GUARDS,
  createIndexSql,
  dropIndexSql,
  duplicateCountSql,
  duplicateSampleSql,
  findGuard,
  indexStatusSql,
} from "./unique-guards";

// Pure SQL-builder tests. The statements themselves run against Postgres in
// prisma/bootstrap.ts and src/actions/unique-guards.actions.ts; here we pin the
// invariants the rest of the app relies on.

const KNOWN_TABLES = new Set(["Contact", "Vendor", "HallOwner"]);

describe("GUARDS list", () => {
  it("has unique names and unique index names", () => {
    const names = GUARDS.map((g) => g.name);
    const indexes = GUARDS.map((g) => g.indexName);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("only targets tables whose columns exist and never uses Prisma's @unique name shape", () => {
    for (const g of GUARDS) {
      expect(KNOWN_TABLES.has(g.table)).toBe(true);
      expect(["phone", "email"]).toContain(g.keyType);
      // A future `@unique` would be minted as `<Table>_<col>_key`; ours must not collide.
      expect(g.indexName.endsWith("_key")).toBe(false);
      expect(g.indexName.startsWith(`${g.table}_`)).toBe(true);
    }
  });

  it("excludes soft-deleted / archived rows via the partial predicate", () => {
    for (const g of GUARDS) {
      if (g.table === "Vendor") expect(g.where).toContain(`"isArchived" = false`);
      else expect(g.where).toContain(`"deletedAt" IS NULL`);
    }
  });

  it("keeps Contact guards manual (exact-match create paths) and the rest auto-applied", () => {
    for (const g of GUARDS) {
      expect(g.autoApply).toBe(g.table !== "Contact");
    }
  });

  it("normalises phone like phoneDigits but keeps a stated foreign country code", () => {
    const phoneGuards = GUARDS.filter((g) => g.keyType === "phone");
    expect(phoneGuards.length).toBeGreaterThan(0);
    for (const g of phoneGuards) {
      // bare 10 digits -> '91' + digits
      expect(g.expression).toContain(`= 10 THEN '91' ||`);
      // trunk 0 + 10 digits -> '91' + last 10
      expect(g.expression).toContain(`= 11 AND left(`);
      expect(g.expression).toContain(`THEN '91' || right(`);
      // anything else (e.g. "+1 415…") keeps its full digit string
      expect(g.expression).toMatch(/ELSE regexp_replace\("phone", '\[\^0-9\]', '', 'g'\) END$/);
      // a phone with no digits at all must not be indexed as ''
      expect(g.where).toContain(`<> ''`);
    }
  });

  it("normalises email as lower(btrim(...)) and skips blank emails", () => {
    for (const g of GUARDS.filter((x) => x.keyType === "email")) {
      expect(g.expression).toBe(`lower(btrim("email"))`);
      expect(g.where).toContain(`btrim("email") <> ''`);
    }
  });
});

describe("SQL builders", () => {
  it("never emit a backslash (independent of standard_conforming_strings)", () => {
    for (const g of GUARDS) {
      for (const sql of [createIndexSql(g), dropIndexSql(g), duplicateCountSql(g), duplicateSampleSql(g), indexStatusSql(g)]) {
        expect(sql).not.toContain("\\");
      }
    }
  });

  it("createIndexSql is a partial, concurrent, idempotent unique index on the expression", () => {
    for (const g of GUARDS) {
      const sql = createIndexSql(g);
      expect(sql.startsWith(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "${g.indexName}" ON "${g.table}" ((`)).toBe(true);
      expect(sql).toContain(`((${g.expression}))`);
      expect(sql.endsWith(` WHERE ${g.where}`)).toBe(true);
    }
  });

  it("dropIndexSql is concurrent and idempotent", () => {
    for (const g of GUARDS) {
      expect(dropIndexSql(g)).toBe(`DROP INDEX CONCURRENTLY IF EXISTS "${g.indexName}"`);
    }
  });

  it("duplicateCountSql counts keys held by more than one live row as an int", () => {
    for (const g of GUARDS) {
      const sql = duplicateCountSql(g);
      expect(sql).toContain(`count(*)::int AS "groups"`);
      expect(sql).toContain(`FROM "${g.table}" WHERE ${g.where} GROUP BY (${g.expression}) HAVING count(*) > 1`);
    }
  });

  it("duplicateSampleSql clamps the limit to 1..50 and defaults to 5", () => {
    const g = GUARDS[0];
    expect(duplicateSampleSql(g)).toMatch(/LIMIT 5$/);
    expect(duplicateSampleSql(g, 0)).toMatch(/LIMIT 1$/);
    expect(duplicateSampleSql(g, 999)).toMatch(/LIMIT 50$/);
    expect(duplicateSampleSql(g, 7.9)).toMatch(/LIMIT 7$/);
    expect(duplicateSampleSql(g, Number.NaN)).toMatch(/LIMIT 5$/);
    expect(duplicateSampleSql(g)).toContain(`(${g.expression}) AS "key", count(*)::int AS "count"`);
    expect(duplicateSampleSql(g)).toContain("HAVING count(*) > 1 ORDER BY 2 DESC, 1 ASC");
  });

  it("indexStatusSql reads indisvalid for exactly this index in the current schema", () => {
    for (const g of GUARDS) {
      const sql = indexStatusSql(g);
      expect(sql).toContain(`i.indisvalid AS "valid"`);
      expect(sql).toContain(`n.nspname = current_schema()`);
      expect(sql).toContain(`c.relname = '${g.indexName}'`);
    }
  });
});

describe("findGuard", () => {
  it("resolves only names from the constant list", () => {
    expect(findGuard("vendor_phone")).toBe(GUARDS.find((g) => g.name === "vendor_phone"));
    expect(findGuard("nope")).toBeNull();
    expect(findGuard(`"Contact"; DROP TABLE "Contact"; --`)).toBeNull();
    expect(findGuard("")).toBeNull();
  });
});
