"use server";

// ============================================================
// Customer / host portal invite → activate. Single-step: staff invite a contact;
// the host opens the link (logged OUT), sets their OWN password, and a CLIENT
// account is created — email-verified and bound to the contact's email (the
// portal's C9 identity resolves by matching User.email == Contact.email).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import bcryptjs from "bcryptjs";
import { createPortalInvite, checkPortalInvite, consumePortalInvite } from "@/lib/portal-invite";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Staff: mint the invite link (no email service → return a copyable URL). Gated on contacts:update.
export async function generateHostInvite(contactId: string): Promise<Result<{ url: string; email: string; name: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role as string, "contacts:update")) {
    return { success: false, error: "Insufficient permissions" };
  }
  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true } });
  if (!contact) return { success: false, error: "Contact not found" };
  if (!contact.email?.trim()) return { success: false, error: "This contact has no email on file — add one before inviting." };

  const token = await createPortalInvite(contact.id);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/host-activate?contact=${contact.id}&token=${token}`;
  await logActivity({ userId: session.user.id as string, action: "invited", entityType: "Contact", entityId: contact.id });
  return { success: true, data: { url, email: contact.email, name: `${contact.firstName} ${contact.lastName}`.trim() } };
}

// PUBLIC: validate the token and return the contact's name/email to render the form.
export async function getHostInvitePreview(
  contactId: string,
  token: string,
): Promise<{ valid: true; name: string; email: string } | { valid: false; reason: string }> {
  const state = await checkPortalInvite(contactId, token);
  if (state !== "valid") return { valid: false, reason: state };
  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null }, select: { firstName: true, lastName: true, email: true } });
  if (!contact?.email?.trim()) return { valid: false, reason: "no-email" };
  return { valid: true, name: `${contact.firstName} ${contact.lastName}`.trim(), email: contact.email };
}

// PUBLIC: provision the CLIENT account (host sets their OWN password). Takeover-safe —
// if ANY account already exists for that email, we refuse rather than touch it.
export async function acceptHostInvite(params: { contactId: string; token: string; password: string }): Promise<Result<{ email: string }>> {
  const { contactId, token, password } = params;
  if (!contactId || !token) return { success: false, error: "This activation link is invalid." };
  if (!password || password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const state = await checkPortalInvite(contactId, token);
  if (state === "expired") return { success: false, error: "This link has expired. Please ask us for a fresh one." };
  if (state !== "valid") return { success: false, error: "This link is invalid or has already been used." };

  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null }, select: { firstName: true, lastName: true, email: true } });
  if (!contact?.email?.trim()) return { success: false, error: "This contact has no email on file." };
  const email = contact.email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) {
    return { success: false, error: "An account already exists for this email. Please sign in, or contact us to link your bookings." };
  }

  const hashedPassword = await bcryptjs.hash(password, 12);
  await prisma.user.create({
    data: { name: `${contact.firstName} ${contact.lastName}`.trim() || email, email, hashedPassword, role: "CLIENT", emailVerified: new Date() },
  });
  await consumePortalInvite(contactId, token);
  return { success: true, data: { email } };
}
