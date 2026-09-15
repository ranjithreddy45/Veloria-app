"use client";

// ============================================================
// SplitPay — the /pay/split/<token> checkout. A thin wrapper that binds the
// split token to the shared PublicPay component (same Razorpay checkout,
// same verify path as /pay/<invoice>), so nothing is forked.
// ============================================================

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PublicPay } from "@/app/pay/[token]/_components/public-pay";
import { createSplitRazorpayOrder } from "@/actions/payment-split.actions";

interface Props {
  token: string;
  invoiceId: string;
  invoiceNumber: string;
  amountRupees: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  eventName: string | null;
}

export function SplitPay({
  token,
  invoiceId,
  invoiceNumber,
  amountRupees,
  payerName,
  payerEmail,
  payerPhone,
  eventName,
}: Props) {
  const router = useRouter();
  const createOrder = useCallback(() => createSplitRazorpayOrder(token), [token]);
  // After a verified capture the server has flipped the split PAID; refresh
  // so a reload shows the "paid" state instead of an active Pay button.
  const onSuccess = useCallback(() => router.refresh(), [router]);

  return (
    <PublicPay
      invoiceId={invoiceId}
      invoiceNumber={invoiceNumber}
      amount={amountRupees}
      customerName={payerName}
      customerEmail={payerEmail}
      customerPhone={payerPhone}
      createOrder={createOrder}
      description={`${payerName}'s share${eventName ? ` — ${eventName}` : ""} (${invoiceNumber})`}
      onSuccess={onSuccess}
    />
  );
}
