"use client";

// ============================================================
// Pay-amount picker — status-quo default applied to collections.
// When the invoice has a staged installment plan and the link didn't pin an
// amount, the earliest unpaid installment is PRE-SELECTED (the default wins);
// the full balance stays one tap away. Falls back to a single button when
// there's nothing to choose between.
// ============================================================

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicPay } from "./public-pay";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  nextDue: { label: string; amount: number } | null;
  balanceDue: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export function PayAmountPicker({ invoiceId, invoiceNumber, nextDue, balanceDue, customerName, customerEmail, customerPhone }: Props) {
  // Default = the due installment (status quo); switching is the active choice.
  const hasChoice = !!nextDue && nextDue.amount < balanceDue;
  const [payFull, setPayFull] = useState(!hasChoice);
  const amount = payFull || !nextDue ? balanceDue : nextDue.amount;

  // Two side-by-side options stay side-by-side on a phone — this is a
  // comparison, and stacking them pushes the Pay button below the fold. The
  // cells are sized so a 9-10 character INR figure still fits at 375px:
  // p-2.5 leaves ~124px of inner width against ~95px of glyphs.
  return (
    <div className="space-y-3">
      {hasChoice && nextDue && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose amount to pay">
          <button
            type="button"
            role="radio"
            aria-checked={!payFull}
            onClick={() => setPayFull(false)}
            className={cn(
              "rounded-xl border p-2.5 text-left transition sm:p-3",
              !payFull
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40"
            )}
          >
            <span className="flex items-center justify-between gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Due now
              {!payFull && <Check className="size-3.5 shrink-0 text-primary" />}
            </span>
            <span className="mt-1 block text-[16px] font-semibold tabular-nums text-foreground sm:text-[17px]">
              {inr(nextDue.amount)}
            </span>
            <span className="block truncate text-[11.5px] text-muted-foreground">{nextDue.label}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={payFull}
            onClick={() => setPayFull(true)}
            className={cn(
              "rounded-xl border p-2.5 text-left transition sm:p-3",
              payFull
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40"
            )}
          >
            <span className="flex items-center justify-between gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Full balance
              {payFull && <Check className="size-3.5 shrink-0 text-primary" />}
            </span>
            <span className="mt-1 block text-[16px] font-semibold tabular-nums text-foreground sm:text-[17px]">
              {inr(balanceDue)}
            </span>
            <span className="block text-[11.5px] text-muted-foreground">Clear it in one go</span>
          </button>
        </div>
      )}
      <PublicPay
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        amount={amount}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
      />
    </div>
  );
}
