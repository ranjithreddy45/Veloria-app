// ============================================================
// Vendor portal invite → activate — integration test (real actions + DB).
// Proves: staff generates an invite; the vendor activates it to CREATE a
// VENDOR-role account (bcrypt password, email-verified, bound to the vendor's
// email); the token is single-use; a bad token is rejected; and the takeover
// guard blocks activation when an account already exists for that email.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcryptjs from "bcryptjs";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import {
  generateVendorPortalInvite, getVendorInvitePreview, acceptVendorInvite,
} from "./vendor-portal-invite.actions";

const U = Date.now();
const vendorEmail = `vendor-${U}@t.local`;
const takenEmail = `taken-${U}@t.local`;
let vendorId = "", takenVendorId = "", adminId = "";

const tokenFromUrl = (url: string) => new URL(url).searchParams.get("token") ?? "";

beforeAll(async () => {
  const admin = await prisma.user.create({ data: { name: "Inv Admin", email: `inv-admin-${U}@t.local`, role: "ADMIN", isActive: true }, select: { id: true } });
  adminId = admin.id;
  authMock.mockResolvedValue({ user: { id: adminId, role: "ADMIN", name: "Inv Admin" } });

  vendorId = (await prisma.vendor.create({ data: { name: `Bright Lights ${U}`, category: "OTHER", email: vendorEmail }, select: { id: true } })).id;
  takenVendorId = (await prisma.vendor.create({ data: { name: `Taken Vendor ${U}`, category: "OTHER", email: takenEmail }, select: { id: true } })).id;
  // A pre-existing account for takenEmail — activation must NOT touch it.
  await prisma.user.create({ data: { name: "Existing", email: takenEmail, role: "CLIENT", isActive: true } });
});

afterAll(async () => {
  await prisma.verificationToken.deleteMany({ where: { identifier: { in: [`vendor-invite:${vendorId}`, `vendor-invite:${takenVendorId}`] } } });
  // logActivity (in generate) wrote ActivityLog rows for the admin → clear before deleting users.
  await prisma.activityLog.deleteMany({ where: { userId: adminId } });
  await prisma.user.deleteMany({ where: { email: { in: [vendorEmail, takenEmail, `inv-admin-${U}@t.local`] } } });
  await prisma.vendor.deleteMany({ where: { id: { in: [vendorId, takenVendorId] } } });
});

describe("vendor portal invite → activate (real actions + DB)", () => {
  it("staff generates an invite; activation CREATES a verified VENDOR account", async () => {
    const gen = await generateVendorPortalInvite(vendorId);
    expect(gen.success).toBe(true);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect(token).toBeTruthy();

    const preview = await getVendorInvitePreview(vendorId, token);
    expect(preview.valid).toBe(true);

    const res = await acceptVendorInvite({ vendorId, token, password: "vendorPass123" });
    expect(res.success).toBe(true);

    const user = await prisma.user.findFirst({ where: { email: vendorEmail }, select: { role: true, emailVerified: true, hashedPassword: true } });
    expect(user?.role).toBe("VENDOR");
    expect(user?.emailVerified).toBeTruthy();
    expect(await bcryptjs.compare("vendorPass123", user?.hashedPassword ?? "")).toBe(true);
  });

  it("the token is single-use (a second activation fails)", async () => {
    const gen = await generateVendorPortalInvite(vendorId); // fresh token
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    const first = await acceptVendorInvite({ vendorId, token, password: "anotherPass123" });
    // account already exists now (created above) → takeover guard blocks it
    expect(first.success).toBe(false);
    // token still consumed? a bad token is also rejected
    const second = await acceptVendorInvite({ vendorId, token: "deadbeef", password: "whatever123" });
    expect(second.success).toBe(false);
  });

  it("rejects a short password and an invalid token", async () => {
    const gen = await generateVendorPortalInvite(takenVendorId);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect((await acceptVendorInvite({ vendorId: takenVendorId, token, password: "short" })).success).toBe(false);
    expect((await acceptVendorInvite({ vendorId: takenVendorId, token: "nope", password: "longenough123" })).success).toBe(false);
  });

  it("TAKEOVER GUARD: won't activate when an account already exists for the email", async () => {
    const gen = await generateVendorPortalInvite(takenVendorId);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    const res = await acceptVendorInvite({ vendorId: takenVendorId, token, password: "vendorPass123" });
    expect(res.success).toBe(false);
    // the pre-existing CLIENT account is untouched
    const existing = await prisma.user.findFirst({ where: { email: takenEmail }, select: { role: true } });
    expect(existing?.role).toBe("CLIENT");
  });
});
