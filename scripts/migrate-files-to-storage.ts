/**
 * Move inline uploads (base64 data-URLs in Postgres text columns) into object
 * storage, replacing each with an `s3://<bucket>/<key>` ref in the SAME column.
 *
 *   npx tsx scripts/migrate-files-to-storage.ts --dry-run
 *   npx tsx scripts/migrate-files-to-storage.ts --limit 200
 *   npx tsx scripts/migrate-files-to-storage.ts --targets hr-claim-attachments,leads
 *   npx tsx scripts/migrate-files-to-storage.ts --list
 *
 * Env: DATABASE_URL + STORAGE_DRIVER=s3 + STORAGE_S3_* (read from .env.local /
 * .env, or the shell). A dry run needs only DATABASE_URL.
 *
 *   --dry-run        count rows + decoded bytes per target; upload nothing
 *   --limit N        stop after N rows have been migrated (across targets)
 *   --targets a,b    only these targets (see --list); default = the SAFE set
 *   --batch N        rows per page (default 50)
 *   --list           print the targets and exit
 *
 * Safety:
 *   - Idempotent: rows already holding refs are not selected; in array columns
 *     only the data-URL elements are replaced, refs/links are left alone.
 *   - Interrupt-safe: each row is rewritten immediately after its own bytes
 *     are uploaded, so Ctrl-C loses at most one in-flight object (which is
 *     still recorded in StoredFile). Re-running continues where it left off.
 *   - Read boundaries: only targets whose EVERY reader accepts refs are in the
 *     default set. The opt-in targets are listed with the reader that still
 *     needs a resolve; migrate them only after that reader is updated.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

type Args = { dryRun: boolean; limit: number | null; targets: string[] | null; batch: number; list: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, limit: null, targets: null, batch: 50, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a === "--list") args.list = true;
    else if (a === "--limit") args.limit = Math.max(0, Number(argv[++i]) || 0);
    else if (a.startsWith("--limit=")) args.limit = Math.max(0, Number(a.slice(8)) || 0);
    else if (a === "--batch") args.batch = Math.max(1, Number(argv[++i]) || 50);
    else if (a.startsWith("--batch=")) args.batch = Math.max(1, Number(a.slice(8)) || 50);
    else if (a === "--targets") args.targets = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--targets=")) args.targets = a.slice(10).split(",").map((s) => s.trim()).filter(Boolean);
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

/** Decoded byte size of a base64 data-URL without decoding it. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function human(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)}GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.round(bytes / 1000)}KB`;
}

type Row = { id: string; value: string | string[] };

interface Target {
  name: string;
  column: string;
  prefix: string;
  ownerType: string;
  /** In the default set: every reader of this column accepts refs. */
  safe: boolean;
  note?: string;
  /** Rows with id > afterId (id asc) that may still hold inline data. */
  page(afterId: string | null, take: number): Promise<Row[]>;
  write(id: string, value: string | string[]): Promise<void>;
}

let stopRequested = false;
process.on("SIGINT", () => {
  if (stopRequested) process.exit(130);
  stopRequested = true;
  console.log("\nStopping after the current row… (Ctrl-C again to force)");
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Imported AFTER dotenv so DATABASE_URL / STORAGE_* are in place.
  const { prisma } = await import("../src/lib/prisma");
  const { isDataUrl, storeIncomingFile } = await import("../src/lib/storage/data-url");
  const { isObjectStorageEnabled, storageDriverName } = await import("../src/lib/storage");

  const after = (id: string | null) => (id ? { id: { gt: id } } : {});

  const targets: Target[] = [
    {
      name: "hr-claim-attachments",
      column: "HrClaimAttachment.data",
      prefix: "hr/claims",
      ownerType: "HrClaimAttachment",
      safe: true,
      page: async (afterId, take) =>
        (
          await prisma.hrClaimAttachment.findMany({
            where: { data: { startsWith: "data:" }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, data: true },
          })
        ).map((r) => ({ id: r.id, value: r.data })),
      write: async (id, value) => {
        await prisma.hrClaimAttachment.update({ where: { id }, data: { data: value as string } });
      },
    },
    {
      name: "hr-claim-bills",
      column: "HrReimbursementClaim.billUrl",
      prefix: "hr/claims",
      ownerType: "HrReimbursementClaim",
      safe: true,
      page: async (afterId, take) =>
        (
          await prisma.hrReimbursementClaim.findMany({
            where: { billUrl: { startsWith: "data:" }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, billUrl: true },
          })
        ).map((r) => ({ id: r.id, value: r.billUrl ?? "" })),
      write: async (id, value) => {
        await prisma.hrReimbursementClaim.update({ where: { id }, data: { billUrl: value as string } });
      },
    },
    {
      name: "handbook",
      column: "Document.url (category HANDBOOK)",
      prefix: "hr/handbook",
      ownerType: "Document",
      safe: true,
      page: async (afterId, take) =>
        (
          await prisma.document.findMany({
            where: { category: "HANDBOOK", url: { startsWith: "data:" }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, url: true },
          })
        ).map((r) => ({ id: r.id, value: r.url ?? "" })),
      write: async (id, value) => {
        await prisma.document.update({ where: { id }, data: { url: value as string } });
      },
    },
    {
      name: "leads",
      column: "Lead.images",
      prefix: "leads",
      ownerType: "Lead",
      safe: true,
      page: async (afterId, take) =>
        (
          await prisma.lead.findMany({
            where: { images: { isEmpty: false }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, images: true },
          })
        ).map((r) => ({ id: r.id, value: r.images })),
      write: async (id, value) => {
        await prisma.lead.update({ where: { id }, data: { images: value as string[] } });
      },
    },
    {
      name: "bd-leads",
      column: "AcqLead.images",
      prefix: "bd/leads",
      ownerType: "AcqLead",
      safe: true,
      page: async (afterId, take) =>
        (
          await prisma.acqLead.findMany({
            where: { images: { isEmpty: false }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, images: true },
          })
        ).map((r) => ({ id: r.id, value: r.images })),
      write: async (id, value) => {
        await prisma.acqLead.update({ where: { id }, data: { images: value as string[] } });
      },
    },
    {
      name: "bd-deals",
      column: "AcqDeal.images",
      prefix: "bd/deals",
      ownerType: "AcqDeal",
      safe: false,
      note: "also read by getAcqProperty (src/actions/acq-property.actions.ts) for the property page — add resolveFileValues there first",
      page: async (afterId, take) =>
        (
          await prisma.acqDeal.findMany({
            where: { images: { isEmpty: false }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, images: true },
          })
        ).map((r) => ({ id: r.id, value: r.images })),
      write: async (id, value) => {
        await prisma.acqDeal.update({ where: { id }, data: { images: value as string[] } });
      },
    },
    {
      name: "bd-attachments",
      column: "AcqAttachment.url",
      prefix: "bd/attachments",
      ownerType: "AcqAttachment",
      safe: false,
      note: "also read by getAcqProperty (acq-property.actions.ts) and the guest photo route (src/app/api/guest/photo/[kind]/[id]/route.ts, which redirects to the raw value) — make both ref-aware first",
      page: async (afterId, take) =>
        (
          await prisma.acqAttachment.findMany({
            where: { url: { startsWith: "data:" }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, url: true },
          })
        ).map((r) => ({ id: r.id, value: r.url })),
      write: async (id, value) => {
        await prisma.acqAttachment.update({ where: { id }, data: { url: value as string } });
      },
    },
    {
      name: "documents",
      column: "Document.url (every category)",
      prefix: "documents",
      ownerType: "Document",
      safe: false,
      note: "/api/documents/[id] redirects to the raw value and document.actions is not ref-aware — update those readers first",
      page: async (afterId, take) =>
        (
          await prisma.document.findMany({
            where: { category: { not: "HANDBOOK" }, url: { startsWith: "data:" }, ...after(afterId) },
            orderBy: { id: "asc" },
            take,
            select: { id: true, url: true },
          })
        ).map((r) => ({ id: r.id, value: r.url ?? "" })),
      write: async (id, value) => {
        await prisma.document.update({ where: { id }, data: { url: value as string } });
      },
    },
  ];

  if (args.list) {
    for (const t of targets) {
      console.log(`${t.safe ? "[default]" : "[opt-in] "} ${t.name.padEnd(22)} ${t.column}${t.note ? `\n${" ".repeat(33)}${t.note}` : ""}`);
    }
    await prisma.$disconnect();
    return;
  }

  let selected: Target[];
  const wanted = args.targets;
  if (wanted) {
    const unknown = wanted.filter((n) => !targets.some((t) => t.name === n));
    if (unknown.length) {
      console.error(`Unknown target(s): ${unknown.join(", ")}. Use --list.`);
      process.exit(2);
    }
    selected = targets.filter((t) => wanted.includes(t.name));
  } else {
    selected = targets.filter((t) => t.safe);
  }

  console.log(`Target DB host: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]+@/, ":***@").replace(/\?.*$/, "")}`);
  console.log(`Storage driver: ${storageDriverName()}${isObjectStorageEnabled() ? " (configured)" : " (NOT configured)"}`);
  console.log(`${args.dryRun ? "[DRY RUN] " : ""}targets: ${selected.map((t) => t.name).join(", ")}${args.limit != null ? ` · limit ${args.limit} rows` : ""} · batch ${args.batch}\n`);
  for (const t of selected.filter((t) => !t.safe)) {
    console.log(`  WARNING opt-in target ${t.name}: ${t.note}`);
  }

  if (!args.dryRun && !isObjectStorageEnabled()) {
    console.error("\nRefusing to migrate: STORAGE_DRIVER must be \"s3\" and STORAGE_S3_BUCKET / ACCESS_KEY / SECRET_KEY set. Use --dry-run to count.");
    process.exit(1);
  }

  const totals = { rows: 0, files: 0, bytes: 0 };
  let migratedRows = 0;

  for (const t of selected) {
    if (stopRequested) break;
    const stat = { scanned: 0, rows: 0, files: 0, bytes: 0 };
    let afterId: string | null = null;
    console.log(`▶ ${t.name} (${t.column})`);

    for (;;) {
      if (stopRequested) break;
      if (args.limit != null && migratedRows >= args.limit) break;
      const rows = await t.page(afterId, args.batch);
      if (rows.length === 0) break;
      afterId = rows[rows.length - 1].id;

      for (const row of rows) {
        if (stopRequested) break;
        if (args.limit != null && migratedRows >= args.limit) break;
        stat.scanned++;

        const values = Array.isArray(row.value) ? row.value : [row.value];
        const inline = values.filter((v) => isDataUrl(v));
        if (inline.length === 0) continue; // already refs / links — idempotent skip

        const rowBytes = inline.reduce((s, v) => s + dataUrlBytes(v), 0);
        if (args.dryRun) {
          stat.rows++;
          stat.files += inline.length;
          stat.bytes += rowBytes;
          migratedRows++;
          continue;
        }

        try {
          const next: string[] = [];
          for (const v of values) {
            if (!isDataUrl(v)) {
              next.push(v);
              continue;
            }
            const stored = await storeIncomingFile(v, { prefix: t.prefix, ownerType: t.ownerType, ownerId: row.id });
            if (stored === v) throw new Error("storeIncomingFile returned the value unchanged — object storage not enabled?");
            next.push(stored);
          }
          await t.write(row.id, Array.isArray(row.value) ? next : next[0]);
          stat.rows++;
          stat.files += inline.length;
          stat.bytes += rowBytes;
          migratedRows++;
        } catch (e) {
          console.error(`  ✗ ${t.name} ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
          // Leave the row inline and move on; a re-run picks it up again.
        }
      }
      console.log(`  … ${t.name}: scanned ${stat.scanned}, migrated ${stat.rows} rows / ${stat.files} files / ${human(stat.bytes)}`);
    }

    console.log(`  ✓ ${t.name}: ${args.dryRun ? "would move" : "moved"} ${stat.rows} rows, ${stat.files} files, ${human(stat.bytes)}\n`);
    totals.rows += stat.rows;
    totals.files += stat.files;
    totals.bytes += stat.bytes;
  }

  console.log(
    `${stopRequested ? "Interrupted. " : ""}${args.dryRun ? "Would move" : "Moved"} ${totals.rows} rows, ${totals.files} files, ${human(totals.bytes)} out of Postgres.`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
