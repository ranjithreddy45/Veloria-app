// End-to-end test of the GL self-heal sweep against the real local DB.
// Simulates a silently-failed posting (an ISSUED invoice with no GL entry) and
// verifies reconcileGlPostings() re-posts it, balanced and idempotently.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { seedFinance } from "@/actions/finance.actions";
import { reconcileGlPostings } from "./gl-reconcile";

const U = Date.now();
let adminId: string;
let contactId: string;
let invoiceId: string;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { name: "GL Admin", email: `gl-admin-${U}@t.local`, role: "SUPER_ADMIN", isActive: true },
    select: { id: true },
  });
  adminId = admin.id;
  authMock.mockResolvedValue({ user: { id: adminId, role: "SUPER_ADMIN", name: "GL Admin" } });
  await seedFinance(); // idempotent chart-of-accounts setup

  const contact = await prisma.contact.create({
    data: { firstName: "Gl", lastName: "Tester", phone: `+9196${String(U).slice(-8)}` },
    select: { id: true },
  });
  contactId = contact.id;

  // An ISSUED invoice with NO GL entry — i.e. a posting that silently failed.
  // Tax-free + consistent amounts so the revenue JE balances (Dr AR / Cr Revenue).
  const inv = await prisma.invoice.create({
    data: {
      invoiceNumber: `GLINV-${U}`,
      status: "SENT",
      dueDate: new Date(),
      subtotal: "100000",
      cgstRate: "0",
      sgstRate: "0",
      igstRate: "0",
      cgstAmount: "0",
      sgstAmount: "0",
      igstAmount: "0",
      totalAmount: "100000",
      paidAmount: "0",
      balanceDue: "100000",
      contactId,
      createdById: adminId,
    },
    select: { id: true },
  });
  invoiceId = inv.id;
});

afterAll(async () => {
  const entries = await prisma.finJournalEntry.findMany({ where: { sourceRefId: invoiceId }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  if (entryIds.length) {
    await prisma.finJournalLine.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.finJournalEntry.deleteMany({ where: { id: { in: entryIds } } });
  }
  await prisma.invoice.deleteMany({ where: { id: invoiceId } });
  await prisma.notification.deleteMany({ where: { userId: adminId } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("GL reconcile self-heal", () => {
  it("re-posts an issued invoice that is missing its GL entry", async () => {
    expect(await prisma.finJournalEntry.count({ where: { sourceRefId: invoiceId } })).toBe(0);

    const res = await reconcileGlPostings({ lookbackDays: 1 });
    expect(res.seeded).toBe(true);
    expect(res.invoicesReposted).toBeGreaterThanOrEqual(1);

    const entry = await prisma.finJournalEntry.findFirst({
      where: { sourceRefId: invoiceId },
      select: { status: true },
    });
    expect(entry).toBeTruthy();
    expect(entry!.status).toBe("POSTED");
  });

  it("is idempotent — a second run does not double-post", async () => {
    await reconcileGlPostings({ lookbackDays: 1 });
    expect(await prisma.finJournalEntry.count({ where: { sourceRefId: invoiceId } })).toBe(1);
  });
});
