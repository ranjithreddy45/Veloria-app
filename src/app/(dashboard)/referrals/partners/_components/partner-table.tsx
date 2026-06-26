"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  ExternalLink,
  Check,
  IndianRupee,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReferralPartner } from "@/actions/referral-portal.actions";
import {
  approveReferralPayout,
  payReferralPayout,
  cancelReferralPayout,
} from "@/actions/referral-payout.actions";

// ============================================================
// Partner + payout table — client component
// ------------------------------------------------------------
// Create-partner dialog (createReferralPartner) and the payout ledger with
// approve / pay / cancel actions (referrals:rewards). Lists are server-fetched
// and passed in; mutations refresh via router.refresh().
// ============================================================

interface PartnerRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  submittedCount: number;
  convertedCount: number;
  totalEarned: number;
  totalPaid: number;
  issuedFromReviewId: string | null;
  link: string;
}

interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentRef: string | null;
  partner: { id: string; name: string; code: string; type: string } | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400",
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function PartnerTable({
  partners,
  payouts,
  canManagePayouts,
  canCreate,
}: {
  partners: PartnerRow[];
  payouts: PayoutRow[];
  canManagePayouts: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Partners</h2>
          {canCreate && <CreatePartnerDialog onCreated={() => router.refresh()} />}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="text-right">Converted</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No referral partners yet. Create one to generate a public /refer link.
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/referrals/partners/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1 py-0.5">{p.code}</code>
                        {p.issuedFromReviewId && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            from review
                          </Badge>
                        )}
                        {!p.isActive && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.submittedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.convertedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.totalEarned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <a href={p.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payout ledger</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                {canManagePayouts && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManagePayouts ? 5 : 4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No payouts yet. Payouts accrue automatically when a referred lead converts to a booking.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((row) => (
                  <PayoutLedgerRow
                    key={row.id}
                    row={row}
                    canManage={canManagePayouts}
                    onChange={() => router.refresh()}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function PayoutLedgerRow({
  row,
  canManage,
  onChange,
}: {
  row: PayoutRow;
  canManage: boolean;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [refOpen, setRefOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  const doApprove = () =>
    startTransition(async () => {
      await approveReferralPayout(row.id);
      onChange();
    });

  const doCancel = () =>
    startTransition(async () => {
      await cancelReferralPayout(row.id);
      onChange();
    });

  const doPay = () =>
    startTransition(async () => {
      const res = await payReferralPayout(row.id, paymentRef);
      if (res.success) {
        setRefOpen(false);
        setPaymentRef("");
        onChange();
      }
    });

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{row.partner?.name ?? "—"}</span>
        {row.partner && (
          <code className="ml-2 rounded bg-muted px-1 py-0.5 text-xs">{row.partner.code}</code>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{inr(row.amount)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
          {row.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{row.paymentRef ?? "—"}</TableCell>
      {canManage && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-1.5">
            {row.status === "PENDING" && (
              <>
                <Button size="sm" variant="outline" onClick={doApprove} disabled={pending}>
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={doCancel} disabled={pending}>
                  <Ban className="size-3.5" />
                </Button>
              </>
            )}
            {row.status === "APPROVED" && (
              <Dialog open={refOpen} onOpenChange={setRefOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={pending}>
                    <IndianRupee className="size-3.5" /> Mark paid
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record payout</DialogTitle>
                    <DialogDescription>
                      Mark {inr(row.amount)} to {row.partner?.name ?? "partner"} as paid. Enter the payment reference.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ref-${row.id}`}>Payment reference</Label>
                    <Input
                      id={`ref-${row.id}`}
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="UTR / txn id"
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={doPay} disabled={pending || !paymentRef.trim()}>
                      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Confirm paid
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function CreatePartnerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "PLANNER",
    email: "",
    phone: "",
    payoutType: "FLAT",
    payoutValue: "0",
    payoutPercent: "0",
  });

  const submit = () =>
    startTransition(async () => {
      setError("");
      if (!form.name.trim()) {
        setError("Name is required.");
        return;
      }
      const res = await createReferralPartner({
        name: form.name,
        type: form.type as never,
        email: form.email || undefined,
        phone: form.phone || undefined,
        payoutType: form.payoutType as never,
        payoutValue: Number(form.payoutValue) || 0,
        payoutPercent: Number(form.payoutPercent) || 0,
      });
      if (!res.success) {
        setError(res.error || "Failed to create partner.");
        return;
      }
      setOpen(false);
      setForm({
        name: "",
        type: "PLANNER",
        email: "",
        phone: "",
        payoutType: "FLAT",
        payoutValue: "0",
        payoutPercent: "0",
      });
      onCreated();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> New partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New referral partner</DialogTitle>
          <DialogDescription>
            Generates a unique code and a public /refer link the partner can share.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Name *</Label>
            <Input
              id="np-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Partner / planner name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNER">Planner</SelectItem>
                  <SelectItem value="DECORATOR">Decorator</SelectItem>
                  <SelectItem value="VENDOR">Vendor</SelectItem>
                  <SelectItem value="GUEST">Guest</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payout type</Label>
              <Select
                value={form.payoutType}
                onValueChange={(v) => setForm((f) => ({ ...f, payoutType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLAT">Flat (₹)</SelectItem>
                  <SelectItem value="PERCENT">Percent of booking</SelectItem>
                  <SelectItem value="POINTS">Loyalty points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email</Label>
              <Input
                id="np-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-phone">Phone</Label>
              <Input
                id="np-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {form.payoutType === "PERCENT" ? (
              <div className="space-y-1.5">
                <Label htmlFor="np-pct">Payout percent</Label>
                <Input
                  id="np-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={form.payoutPercent}
                  onChange={(e) => setForm((f) => ({ ...f, payoutPercent: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="np-val">
                  {form.payoutType === "POINTS" ? "Points per conversion" : "Flat amount (₹)"}
                </Label>
                <Input
                  id="np-val"
                  type="number"
                  min={0}
                  value={form.payoutValue}
                  onChange={(e) => setForm((f) => ({ ...f, payoutValue: e.target.value }))}
                />
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create partner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
