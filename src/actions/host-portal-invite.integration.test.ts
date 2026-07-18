// ============================================================
// Customer/host portal invite → activate — integration test (real actions + DB).
// Proves: staff generate an invite; activation CREATES a verified CLIENT account
// (bcrypt password, bound to the contact's email); single-use; bad inputs
// rejected; and the takeover guard blocks activation when an account already
// exists for that email.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcryptjs from "bcryptjs";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { generateHostInvite, getHostInvitePreview, acceptHostInvite } from "./host-portal-invite.actions";

const U = Date.now();
const hostEmail = `host-${U}@t.local`;
const takenEmail = `takenhost-${U}@t.local`;
let contactId = "", takenContactId = "", adminId = "";
const tokenFromUrl = (url: string) => new URL(url).searchParams.get("token") ?? "";

beforeAll(async () => {
  const admin = await prisma.user.create({ data: { name: "Host Admin", email: `host-admin-${U}@t.local`, role: "ADMIN", isActive: true }, select: { id: true } });
  adminId = admin.id;
  authMock.mockResolvedValue({ user: { id: adminId, role: "ADMIN", name: "Host Admin" } });

  contactId = (await prisma.contact.create({ data: { firstName: "Neha", lastName: "Rao", email: hostEmail, phone: `+9191${String(U).slice(-8)}` }, select: { id: true } })).id;
  takenContactId = (await prisma.contact.create({ data: { firstName: "Taken", lastName: "Host", email: takenEmail, phone: `+9192${String(U).slice(-8)}` }, select: { id: true } })).id;
  await prisma.user.create({ data: { name: "Existing", email: takenEmail, role: "STAFF", isActive: true } });
});

afterAll(async () => {
  await prisma.verificationToken.deleteMany({ where: { identifier: { in: [`portal-invite:${contactId}`, `portal-invite:${takenContactId}`] } } });
  await prisma.activityLog.deleteMany({ where: { userId: adminId } });
  await prisma.user.deleteMany({ where: { email: { in: [hostEmail, takenEmail, `host-admin-${U}@t.local`] } } });
  await prisma.contact.deleteMany({ where: { id: { in: [contactId, takenContactId] } } });
});

describe("host portal invite → activate (real actions + DB)", () => {
  it("generate → activate creates a verified CLIENT account with a bcrypt password", async () => {
    const gen = await generateHostInvite(contactId);
    expect(gen.success).toBe(true);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect((await getHostInvitePreview(contactId, token)).valid).toBe(true);

    const res = await acceptHostInvite({ contactId, token, password: "hostPass1234" });
    expect(res.success).toBe(true);

    const user = await prisma.user.findFirst({ where: { email: hostEmail }, select: { role: true, emailVerified: true, hashedPassword: true } });
    expect(user?.role).toBe("CLIENT");
    expect(user?.emailVerified).toBeTruthy();
    expect(await bcryptjs.compare("hostPass1234", user?.hashedPassword ?? "")).toBe(true);
  });

  it("single-use: activating again fails (account now exists)", async () => {
    const gen = await generateHostInvite(contactId);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect((await acceptHostInvite({ contactId, token, password: "hostPass1234" })).success).toBe(false);
  });

  it("rejects short password + invalid token", async () => {
    const gen = await generateHostInvite(takenContactId);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect((await acceptHostInvite({ contactId: takenContactId, token, password: "short" })).success).toBe(false);
    expect((await acceptHostInvite({ contactId: takenContactId, token: "nope", password: "longenough12" })).success).toBe(false);
  });

  it("TAKEOVER GUARD: won't activate when an account already exists for the email", async () => {
    const gen = await generateHostInvite(takenContactId);
    const token = gen.success ? tokenFromUrl(gen.data.url) : "";
    expect((await acceptHostInvite({ contactId: takenContactId, token, password: "hostPass1234" })).success).toBe(false);
    const existing = await prisma.user.findFirst({ where: { email: takenEmail }, select: { role: true } });
    expect(existing?.role).toBe("STAFF"); // untouched
  });
});
