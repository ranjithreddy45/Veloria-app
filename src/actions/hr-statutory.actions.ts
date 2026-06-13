"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { encryptField, decryptField, maskPan, maskAadhaar, maskAccount } from "@/lib/hr/crypto";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Every statutory access (view/reveal/update) is logged to the shared audit log.
async function logAccess(userId: string, employeeId: string, action: string, fields?: string[]) {
  await prisma.activityLog.create({
    data: {
      action,
      entityType: "EMPLOYEE_STATUTORY",
      entityId: employeeId,
      changes: fields?.length ? { fields } : undefined,
      userId,
    },
  });
}

export interface StatutoryMasked {
  present: boolean;
  panMasked: string | null;
  aadhaarMasked: string | null;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  uan: string | null;
  esi: string | null;
  pf: string | null;
  pt: string | null;
}

// Masked view — safe to render. Logs a VIEW access.
export async function getStatutoryMasked(employeeId: string): Promise<StatutoryMasked | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:statutory")) return null;

  const rec = await prisma.employeeStatutory.findUnique({ where: { employeeId } });
  await logAccess(u!.id, employeeId, "STATUTORY_VIEWED");

  if (!rec) {
    return { present: false, panMasked: null, aadhaarMasked: null, bankAccountMasked: null, bankIfsc: null, uan: null, esi: null, pf: null, pt: null };
  }
  return {
    present: !!(rec.panEnc || rec.aadhaarEnc || rec.bankAccountEnc || rec.uan || rec.esi),
    panMasked: maskPan(decryptField(rec.panEnc)),
    aadhaarMasked: maskAadhaar(decryptField(rec.aadhaarEnc)),
    bankAccountMasked: maskAccount(decryptField(rec.bankAccountEnc)),
    bankIfsc: rec.bankIfsc,
    uan: rec.uan,
    esi: rec.esi,
    pf: rec.pf,
    pt: rec.pt,
  };
}

// Full reveal — returns plaintext for the encrypted fields. Logs a REVEAL access
// naming the fields. Use sparingly; the UI should request this only on demand.
export async function revealStatutory(employeeId: string): Promise<Result<{ pan: string | null; aadhaar: string | null; bankAccount: string | null }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:statutory")) return { success: false, error: "Not authorized to view statutory details." };

  const rec = await prisma.employeeStatutory.findUnique({ where: { employeeId } });
  await logAccess(u!.id, employeeId, "STATUTORY_REVEALED", ["pan", "aadhaar", "bankAccount"]);

  return {
    success: true,
    data: {
      pan: decryptField(rec?.panEnc),
      aadhaar: decryptField(rec?.aadhaarEnc),
      bankAccount: decryptField(rec?.bankAccountEnc),
    },
  };
}

export interface StatutoryInput {
  pan?: string;
  aadhaar?: string;
  bankAccount?: string;
  bankIfsc?: string;
  uan?: string;
  esi?: string;
  pf?: string;
  pt?: string;
}

// Upsert — encrypts the sensitive fields. A field omitted (undefined) is left
// unchanged; an explicit empty string clears it.
export async function upsertStatutory(employeeId: string, input: StatutoryInput): Promise<Result<{ employeeId: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:statutory")) return { success: false, error: "Not authorized." };

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!emp) return { success: false, error: "Employee not found." };

  // Light validation for India statutory formats (non-blocking beyond shape).
  if (input.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.pan.toUpperCase()))
    return { success: false, error: "PAN must be in the format ABCDE1234F." };
  if (input.aadhaar && input.aadhaar.replace(/\D/g, "").length !== 12)
    return { success: false, error: "Aadhaar must be 12 digits." };
  if (input.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.bankIfsc.toUpperCase()))
    return { success: false, error: "IFSC must be in the format ABCD0123456." };

  const enc = (v?: string) => (v === undefined ? undefined : v === "" ? null : encryptField(v));
  const plain = (v?: string) => (v === undefined ? undefined : v === "" ? null : v);

  const changedFields: string[] = [];
  (["pan", "aadhaar", "bankAccount", "bankIfsc", "uan", "esi", "pf", "pt"] as const).forEach((k) => {
    if (input[k] !== undefined) changedFields.push(k);
  });

  await prisma.employeeStatutory.upsert({
    where: { employeeId },
    create: {
      employeeId,
      panEnc: input.pan ? encryptField(input.pan.toUpperCase()) : null,
      aadhaarEnc: input.aadhaar ? encryptField(input.aadhaar.replace(/\D/g, "")) : null,
      bankAccountEnc: input.bankAccount ? encryptField(input.bankAccount) : null,
      bankIfsc: plain(input.bankIfsc?.toUpperCase()) ?? null,
      uan: plain(input.uan) ?? null,
      esi: plain(input.esi) ?? null,
      pf: plain(input.pf) ?? null,
      pt: plain(input.pt) ?? null,
    },
    update: {
      panEnc: input.pan !== undefined ? (input.pan ? encryptField(input.pan.toUpperCase()) : null) : undefined,
      aadhaarEnc: input.aadhaar !== undefined ? (input.aadhaar ? encryptField(input.aadhaar.replace(/\D/g, "")) : null) : undefined,
      bankAccountEnc: enc(input.bankAccount),
      bankIfsc: plain(input.bankIfsc?.toUpperCase()),
      uan: plain(input.uan),
      esi: plain(input.esi),
      pf: plain(input.pf),
      pt: plain(input.pt),
    },
  });

  await logAccess(u!.id, employeeId, "STATUTORY_UPDATED", changedFields);
  revalidatePath(`/people/${employeeId}`);
  return { success: true, data: { employeeId } };
}
