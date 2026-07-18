"use server";

// ============================================================
// Vendor portal invite → activate. Closes the gap where the VENDOR-role login
// had no provisioning flow. Staff generate an invite for a vendor; the vendor
// activates it (logged OUT) by setting their OWN password, which creates a
// VENDOR account bound to the vendor's email. See src/lib/vendor-invite.ts.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import bcryptjs from "bcryptjs";
import { createVendorInvite, checkVendorInvite, consumeVendorInvite } from "@/lib/vendor-invite";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ------------------------------------------------------------
// Staff: generate the invite link (no email service configured → return the URL
// for staff to share). Gated on vendors:update.
// ------------------------------------------------------------
export async function generateVendorPortalInvite(vendorId: string): Promise<Result<{ url: string; vendorEmail: string; vendorName: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role as string, "vendors:update")) {
    return { success: false, error: "Insufficient permissions" };
  }
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, email: true } });
  if (!vendor) return { success: false, error: "Vendor not found" };
  if (!vendor.email?.trim()) return { success: false, error: "This vendor has no email on file — add one before inviting." };

  const token = await createVendorInvite(vendor.id);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/vendor-activate?vendor=${vendor.id}&token=${token}`;
  await logActivity({ userId: session.user.id as string, action: "invited", entityType: "Vendor", entityId: vendor.id });
  return { success: true, data: { url, vendorEmail: vendor.email, vendorName: vendor.name } };
}

// ------------------------------------------------------------
// PUBLIC: preview for the activation page (validates the token, returns the
// vendor's name/email to render — never any other vendor data).
// ------------------------------------------------------------
export async function getVendorInvitePreview(
  vendorId: string,
  token: string,
): Promise<{ valid: true; vendorName: string; vendorEmail: string } | { valid: false; reason: string }> {
  const state = await checkVendorInvite(vendorId, token);
  if (state !== "valid") return { valid: false, reason: state };
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true, email: true } });
  if (!vendor?.email?.trim()) return { valid: false, reason: "no-email" };
  return { valid: true, vendorName: vendor.name, vendorEmail: vendor.email };
}

// ------------------------------------------------------------
// PUBLIC: provision the VENDOR account. The vendor sets their OWN password here.
// Conservative + takeover-safe: if ANY account already exists for the vendor's
// email, we do NOT touch it (a shared-email customer could otherwise be flipped
// to VENDOR or have their password reset) — staff resolve that case manually.
// ------------------------------------------------------------
export async function acceptVendorInvite(params: { vendorId: string; token: string; password: string }): Promise<Result<{ email: string }>> {
  const { vendorId, token, password } = params;
  if (!vendorId || !token) return { success: false, error: "This activation link is invalid." };
  if (!password || password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const state = await checkVendorInvite(vendorId, token);
  if (state === "expired") return { success: false, error: "This link has expired. Please ask us for a fresh one." };
  if (state !== "valid") return { success: false, error: "This link is invalid or has already been used." };

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, email: true } });
  if (!vendor?.email?.trim()) return { success: false, error: "This vendor has no email on file." };
  const email = vendor.email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) {
    // Never modify a pre-existing account via an invite token (takeover safety).
    return { success: false, error: "An account already exists for this email. Please contact us to enable vendor access." };
  }

  const hashedPassword = await bcryptjs.hash(password, 12);
  await prisma.user.create({
    data: { name: vendor.name, email, hashedPassword, role: "VENDOR", emailVerified: new Date() },
  });
  await consumeVendorInvite(vendorId, token);
  return { success: true, data: { email } };
}
