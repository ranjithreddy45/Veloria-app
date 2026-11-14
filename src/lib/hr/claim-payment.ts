// ============================================================
// Reimbursement payment — pure rules, client-safe.
// ------------------------------------------------------------
// Finance marks an approved claim "Paid" by recording the payment date, the
// amount paid, the mode (bank transfer / UPI / cash) and the transaction or
// UTR reference. All four are required. Only the FINANCE role may do it —
// not HR, not Admin, not Super Admin: Admins (Meghana among them) hold
// finance:read, and the person who approves a claim must not also be the one
// who records it paid.
// ============================================================

export const PAYMENT_MODES = ["BANK_TRANSFER", "UPI", "CASH"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CASH: "Cash",
  PAYROLL: "Payroll",
};

/** Only Finance records a claim as paid. */
export function mayMarkClaimPaid(role: string | null | undefined): boolean {
  return role === "FINANCE";
}

/** Today's date in India as YYYY-MM-DD (the server runs in UTC). */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type PaymentInput = { paidOn?: string; amount?: number | string; mode?: string; reference?: string };
export type CheckedPayment =
  | { ok: true; paidAt: Date; amount: number; mode: PaymentMode; reference: string }
  | { ok: false; error: string };

export function checkPayment(input: PaymentInput, claimAmount: number, now: Date = new Date()): CheckedPayment {
  const paidOn = (input.paidOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { ok: false, error: "Enter the payment date." };
  const paidAt = new Date(`${paidOn}T00:00:00.000Z`);
  if (Number.isNaN(paidAt.getTime()) || paidAt.toISOString().slice(0, 10) !== paidOn) {
    return { ok: false, error: "Enter a valid payment date." };
  }
  if (paidOn > todayIst(now)) return { ok: false, error: "The payment date can't be in the future." };

  const raw = typeof input.amount === "string" ? input.amount.replace(/[,\s₹]/g, "") : input.amount;
  const amount = Number(raw);
  if (raw === "" || raw == null || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the amount paid." };
  if (Math.round(amount * 100) !== amount * 100) return { ok: false, error: "The amount paid can have at most 2 decimals." };
  if (amount > claimAmount + 1e-9) return { ok: false, error: "The amount paid can't be more than the claim amount." };

  const mode = (input.mode ?? "").trim();
  if (!(PAYMENT_MODES as readonly string[]).includes(mode)) return { ok: false, error: "Pick the payment mode: bank transfer, UPI or cash." };

  const reference = (input.reference ?? "").trim();
  if (!reference) return { ok: false, error: "Enter the transaction or UTR reference number." };
  if (reference.length > 100) return { ok: false, error: "The reference is too long (100 characters at most)." };

  return { ok: true, paidAt, amount, mode: mode as PaymentMode, reference };
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

/**
 * "Paid 14 Nov 2026 · UPI · ₹1,200 · Ref 4123…" — the same line for Finance,
 * the approver and the employee. Parts that weren't recorded (claims paid
 * before mode/amount existed) are left out rather than guessed.
 */
export function paymentSummary(p: {
  paidAt: Date | string | null;
  paymentMode?: string | null;
  paidAmount?: number | null;
  paymentRef?: string | null;
}): string | null {
  if (!p.paidAt) return null;
  const date = new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return [
    `Paid ${date}`,
    p.paymentMode ? PAYMENT_MODE_LABEL[p.paymentMode] ?? p.paymentMode : null,
    p.paidAmount != null ? inr(p.paidAmount) : null,
    p.paymentRef ? (p.paymentMode === "PAYROLL" ? p.paymentRef : `Ref ${p.paymentRef}`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
