// Negative tests for the DB-dependent Vendor Module rules (R2, R3, R7, R8, R9,
// R10, R11, R13). The local Docker DB is unavailable, so instead of a live
// integration test we mock prisma/auth and drive the REAL server actions — the
// assertions verify the enforcing branches in the actions themselves.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the data layer + framework deps. vi.hoisted makes `db`/`authMock`
// available to the (hoisted) vi.mock factories below.
const { db, authMock } = vi.hoisted(() => {
  const tbl = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  });
  const database = {
    vendor: tbl(),
    vendorPackage: tbl(),
    vendorPackageSection: tbl(),
    vendorPackageImage: tbl(),
    $transaction: vi.fn(),
  };
  return { db: database, authMock: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createCatalogVendor,
  createPackage,
  updatePackage,
  setPackageStatus,
  archiveVendor,
  setPackageCover,
  addPackageImage,
  reorderPackageImages,
} from "./vendor-catalog.actions";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  // $transaction supports both the array form and the callback form.
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all((arg as unknown[]) ?? [])
  );
});

const validPkg = {
  vendorId: "v1",
  name: "Veg Silver",
  category: "catering",
  price: 950,
  priceUnit: "PER_PLATE",
  sections: [{ title: "Welcome", items: [{ name: "Juice", type: "SINGLE_CHOICE", options: ["A"] }] }],
};

describe("R2 — vendor name unique (case-insensitive)", () => {
  it("rejects a duplicate name", async () => {
    db.vendor.findFirst.mockResolvedValue({ id: "dupe" }); // a vendor already has this name
    const r = await createCatalogVendor({ name: "Spice Route", categories: ["catering"] });
    expect(r.success).toBe(false);
    expect((r as { fields?: Record<string, string> }).fields?.name).toBeTruthy();
    expect(db.vendor.create).not.toHaveBeenCalled();
  });
});

describe("R3 — package category must be one of the vendor's categories", () => {
  it("rejects a category the vendor does not have", async () => {
    db.vendor.findUnique.mockResolvedValue({ id: "v1", categories: ["catering"] });
    const r = await createPackage({ ...validPkg, category: "decor" });
    expect(r.success).toBe(false);
    expect((r as { fields?: Record<string, string> }).fields?.category).toBeTruthy();
    expect(db.vendorPackage.create).not.toHaveBeenCalled();
  });
  it("accepts a valid category", async () => {
    db.vendor.findUnique.mockResolvedValue({ id: "v1", categories: ["catering"] });
    db.vendorPackage.create.mockResolvedValue({ id: "p1" });
    const r = await createPackage({ ...validPkg, category: "catering" });
    expect(r.success).toBe(true);
    expect(db.vendorPackage.create).toHaveBeenCalledOnce();
  });
});

describe("R7 — cover image must belong to the package", () => {
  it("rejects an image that is not in the package", async () => {
    db.vendorPackageImage.findFirst.mockResolvedValue(null);
    const r = await setPackageCover("p1", "imgX");
    expect(r.success).toBe(false);
    expect(db.vendorPackage.update).not.toHaveBeenCalled();
  });
  it("accepts an image that belongs", async () => {
    db.vendorPackageImage.findFirst.mockResolvedValue({ id: "img1" });
    db.vendorPackage.update.mockResolvedValue({});
    const r = await setPackageCover("p1", "img1");
    expect(r.success).toBe(true);
    expect(db.vendorPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coverImageId: "img1" } })
    );
  });
});

describe("R8 — first image auto-becomes cover", () => {
  it("sets cover when the package has none", async () => {
    db.vendorPackageImage.count.mockResolvedValue(0);
    db.vendorPackageImage.create.mockResolvedValue({ id: "img1" });
    db.vendorPackage.updateMany.mockResolvedValue({ count: 1 });
    const r = await addPackageImage("p1", "https://cdn.example/a.jpg");
    expect(r.success).toBe(true);
    // Atomic claim: only updates when coverImageId is still null (no read-then-write race).
    expect(db.vendorPackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", coverImageId: null },
        data: { coverImageId: "img1" },
      })
    );
  });
  it("does NOT overwrite an existing cover (guarded by coverImageId: null)", async () => {
    db.vendorPackageImage.count.mockResolvedValue(2);
    db.vendorPackageImage.create.mockResolvedValue({ id: "img3" });
    // DB no-ops because a cover already exists: count 0 rows match the guard.
    db.vendorPackage.updateMany.mockResolvedValue({ count: 0 });
    const r = await addPackageImage("p1", "https://cdn.example/c.jpg");
    expect(r.success).toBe(true);
    // The guard (coverImageId: null) is what prevents clobbering an existing cover.
    expect(db.vendorPackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", coverImageId: null } })
    );
    expect(db.vendorPackage.update).not.toHaveBeenCalled();
  });
  it("rejects a non-http url", async () => {
    const r = await addPackageImage("p1", "not-a-url");
    expect(r.success).toBe(false);
    expect(db.vendorPackageImage.create).not.toHaveBeenCalled();
  });
});

describe("R9/R12 — update replaces the graph atomically", () => {
  it("deletes existing sections inside a transaction before recreating", async () => {
    db.vendorPackage.findUnique.mockResolvedValue({ id: "p1" });
    db.vendor.findUnique.mockResolvedValue({ categories: ["catering"] });
    db.vendorPackageSection.deleteMany.mockResolvedValue({ count: 1 });
    db.vendorPackage.update.mockResolvedValue({ id: "p1" });
    const r = await updatePackage("p1", validPkg);
    expect(r.success).toBe(true);
    expect(db.$transaction).toHaveBeenCalled();
    expect(db.vendorPackageSection.deleteMany).toHaveBeenCalledWith({ where: { packageId: "p1" } });
  });
});

describe("R10 — vendors are soft-deleted (archived), never removed", () => {
  it("sets isArchived true instead of deleting", async () => {
    db.vendor.update.mockResolvedValue({ id: "v1" });
    const r = await archiveVendor("v1");
    expect(r.success).toBe(true);
    expect(db.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "v1" }, data: { isArchived: true } })
    );
    expect(db.vendor.delete).not.toHaveBeenCalled();
  });
});

describe("R11 — image reorder persists atomically", () => {
  it("runs the updates in a single transaction", async () => {
    db.vendorPackageImage.updateMany.mockReturnValue({});
    const r = await reorderPackageImages("p1", ["a", "b", "c"]);
    expect(r.success).toBe(true);
    expect(db.$transaction).toHaveBeenCalledOnce();
  });
});

describe("R13 — archived package cannot go straight to active", () => {
  it("blocks ARCHIVED → ACTIVE (must re-open to draft)", async () => {
    db.vendorPackage.findUnique.mockResolvedValue({
      id: "p1", status: "ARCHIVED", vendorId: "v1", name: "X", category: "catering",
      price: 10, priceUnit: "PER_PLATE", vendor: { categories: ["catering"] }, sections: [],
    });
    const r = await setPackageStatus("p1", "ACTIVE");
    expect(r.success).toBe(false);
    expect(db.vendorPackage.update).not.toHaveBeenCalled();
  });
});

describe("auth gate", () => {
  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    const r = await archiveVendor("v1");
    expect(r.success).toBe(false);
    expect(db.vendor.update).not.toHaveBeenCalled();
  });
});
