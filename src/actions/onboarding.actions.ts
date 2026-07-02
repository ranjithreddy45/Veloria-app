"use server";

// ============================================================
// Onboarding progress — powers the dashboard "Getting Started" checklist.
// Computes which first-run milestones the company has hit from real data, so a
// new user has a clear, self-updating path. Company-wide by design (single-
// company ERP): once anyone books/quotes, the step is done for everyone.
// Additive: read-only counts, no schema change.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { razorpayConfigured } from "@/lib/payments/razorpay-creds";

export interface OnboardingStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
  icon: string; // lucide name resolved on the client
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  allDone: boolean;
}

export async function getOnboardingProgress(): Promise<OnboardingProgress | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [leads, quotesSent, bookings, payments, teamUsers] = await Promise.all([
    prisma.lead.count(),
    prisma.salesQuotation.count({ where: { status: { in: ["SENT", "APPROVED"] } } }),
    prisma.booking.count({ where: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } } }),
    prisma.payment.count({ where: { status: "COMPLETED" } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const paymentsReady = razorpayConfigured();

  const steps: OnboardingStep[] = [
    {
      key: "lead", icon: "UserPlus",
      label: "Capture your first enquiry",
      hint: "Log a customer enquiry so the team can follow up and quote.",
      href: "/leads", cta: "Add enquiry", done: leads > 0,
    },
    {
      key: "quote", icon: "FileText",
      label: "Send a quotation",
      hint: "Build a branded quote and send it by email or WhatsApp.",
      href: "/quotations", cta: "Create quote", done: quotesSent > 0,
    },
    {
      key: "booking", icon: "CalendarCheck",
      label: "Confirm a booking",
      hint: "Block the slot and confirm once the advance is in.",
      href: "/bookings", cta: "View bookings", done: bookings > 0,
    },
    {
      key: "payment", icon: "IndianRupee",
      label: "Collect a payment",
      hint: "Record an advance or send a payment link to the customer.",
      href: "/invoices", cta: "Open invoices", done: payments > 0,
    },
    {
      key: "team", icon: "Users",
      label: "Invite your team",
      hint: "Add your sales, BD and ops teammates with the right roles.",
      href: "/settings/users", cta: "Manage team", done: teamUsers > 1,
    },
    {
      key: "payments-setup", icon: "CreditCard",
      label: "Turn on online payments",
      hint: "Connect Razorpay so customers can pay the advance online.",
      href: "/settings/integrations", cta: "Set up", done: paymentsReady,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, allDone: doneCount === steps.length };
}
