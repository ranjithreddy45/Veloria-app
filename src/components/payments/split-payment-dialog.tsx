"use client";

// ============================================================
// SplitPaymentDialog — "Split this amount" (host portal + staff booking page).
// Step 1: pick the amount to split (next due / everything left / custom),
// add payers, split equally or type shares, watch the live remaining counter.
// Step 2: shareable links per payer — Copy, WhatsApp, Copy all.
// Money is integer paise; the server re-validates every rule.
// ============================================================

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, MessageCircle, Plus, Split, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createPaymentSplits } from "@/actions/payment-split.actions";
import {
  equalSplitPaise,
  formatPaise,
  rupeesToPaise,
  splitWhatsAppText,
  whatsAppShareHref,
  type SplitRow,
  type SplitTarget,
} from "@/lib/payments/split-format";

interface PayerDraft {
  key: number;
  name: string;
  phone: string;
  email: string;
  /** Rupees as typed (may be blank / decimal). */
  amount: string;
}

interface Props {
  target: SplitTarget;
  /** Who is asking — used in the WhatsApp text ("Priya has requested…"). */
  requesterName: string;
  /** Optional trigger override; default is an outline "Split this amount" button. */
  trigger?: ReactNode;
}

const MAX_PAYERS = 20;

function parseRupees(v: string): number | null {
  const n = Number(String(v).replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

let keySeq = 1;
const blankPayer = (): PayerDraft => ({ key: keySeq++, name: "", phone: "", email: "", amount: "" });

export function SplitPaymentDialog({ target, requesterName, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState<string>(() =>
    paiseToInput(target.nextDue ? Math.min(target.nextDue.amountPaise, target.availablePaise) : target.availablePaise)
  );
  const [payers, setPayers] = useState<PayerDraft[]>(() => [blankPayer(), blankPayer()]);
  const [created, setCreated] = useState<SplitRow[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ---- Derived money (all paise) ----
  const totalRupees = parseRupees(total);
  const totalPaise = totalRupees == null ? 0 : rupeesToPaise(totalRupees);
  const shares = payers.map((p) => {
    const r = parseRupees(p.amount);
    return r == null ? 0 : rupeesToPaise(r);
  });
  const assignedPaise = shares.reduce((s, x) => s + x, 0);
  const remainingPaise = totalPaise - assignedPaise;
  const overAvailable = totalPaise > target.availablePaise;
  const problems = useMemo(() => {
    const list: string[] = [];
    if (totalPaise < 100) list.push("Enter the amount to split (at least ₹1).");
    if (overAvailable) list.push(`Only ${formatPaise(target.availablePaise)} can still be split.`);
    if (payers.length === 0) list.push("Add at least one payer.");
    if (payers.some((p) => !p.name.trim())) list.push("Every payer needs a name.");
    if (shares.some((s) => s < 100)) list.push("Every share must be at least ₹1.");
    if (remainingPaise !== 0 && totalPaise >= 100) {
      list.push(
        remainingPaise > 0
          ? `${formatPaise(remainingPaise)} still unassigned.`
          : `Shares exceed the total by ${formatPaise(-remainingPaise)}.`
      );
    }
    return list;
  }, [totalPaise, overAvailable, payers, shares, remainingPaise, target.availablePaise]);
  const canCreate = problems.length === 0 && !saving;
  const nextDue = target.nextDue;

  // ---- Helpers ----
  function updatePayer(key: number, patch: Partial<PayerDraft>) {
    setPayers((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function addPayer() {
    if (payers.length >= MAX_PAYERS) return;
    setPayers((prev) => [...prev, blankPayer()]);
  }
  function removePayer(key: number) {
    setPayers((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.key !== key)));
  }
  function splitEqually() {
    if (totalPaise < 100 || payers.length === 0) return;
    const parts = equalSplitPaise(totalPaise, payers.length);
    setPayers((prev) => prev.map((p, i) => ({ ...p, amount: paiseToInput(parts[i] ?? 0) })));
  }
  function reset() {
    setCreated(null);
    setCopiedId(null);
    setPayers([blankPayer(), blankPayer()]);
    setTotal(
      paiseToInput(target.nextDue ? Math.min(target.nextDue.amountPaise, target.availablePaise) : target.availablePaise)
    );
  }

  async function handleCreate() {
    if (!canCreate) return;
    setSaving(true);
    try {
      const res = await createPaymentSplits({
        invoiceId: target.invoiceId,
        payers: payers.map((p, i) => ({
          name: p.name.trim(),
          phone: p.phone.trim() || undefined,
          email: p.email.trim() || undefined,
          amountPaise: shares[i],
        })),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCreated(res.data.splits);
      toast.success(`${res.data.splits.length} payment link${res.data.splits.length === 1 ? "" : "s"} ready`);
      router.refresh();
    } catch {
      toast.error("Couldn't create the split links. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied");
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link instead.");
    }
  }

  function waText(s: SplitRow) {
    return splitWhatsAppText({
      payerName: s.payerName,
      requesterName,
      amountPaise: s.amountPaise,
      eventName: target.eventName,
      invoiceNumber: target.invoiceNumber,
      url: s.url,
    });
  }

  const allLinksText = created
    ? created.map((s) => `${s.payerName} — ${formatPaise(s.amountPaise)}\n${s.url}`).join("\n\n")
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" disabled={target.availablePaise < 100}>
            <Split className="mr-2 size-4" />
            Split this amount
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            {created ? "Share the links" : "Split this amount"}
          </DialogTitle>
          <DialogDescription>
            {created
              ? "Each person gets their own secure link. Paid shares show up here the moment they come through."
              : `${target.eventName ? `${target.eventName} · ` : ""}Invoice ${target.invoiceNumber} — ${formatPaise(target.availablePaise)} can still be split.`}
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-5">
            {/* ---- Amount to split ---- */}
            <div className="space-y-2">
              <Label htmlFor="split-total">Amount to split</Label>
              <div className="flex flex-wrap gap-2">
                {nextDue && nextDue.amountPaise <= target.availablePaise && (
                  <button
                    type="button"
                    onClick={() => setTotal(paiseToInput(nextDue.amountPaise))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition",
                      totalPaise === nextDue.amountPaise
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:bg-muted/60"
                    )}
                  >
                    {nextDue.label} · {formatPaise(nextDue.amountPaise)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTotal(paiseToInput(target.availablePaise))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    totalPaise === target.availablePaise
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  Everything left · {formatPaise(target.availablePaise)}
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                <Input
                  id="split-total"
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className={cn("pl-7 tabular-nums", overAvailable && "border-destructive")}
                />
              </div>
              {overAvailable && (
                <p className="text-xs text-destructive">
                  Only {formatPaise(target.availablePaise)} is left to split
                  {target.reservedPaise > 0 ? ` (${formatPaise(target.reservedPaise)} is already in pending links)` : ""}.
                </p>
              )}
            </div>

            {/* ---- Payers ---- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Who&apos;s paying</Label>
                <Button type="button" variant="ghost" size="sm" onClick={splitEqually} disabled={totalPaise < 100}>
                  <Split className="mr-1.5 size-3.5" />
                  Split equally between {payers.length}
                </Button>
              </div>
              <div className="space-y-3">
                {payers.map((p, i) => (
                  <div key={p.key} className="rounded-xl border p-3">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        placeholder={`Payer ${i + 1} name`}
                        value={p.name}
                        onChange={(e) => updatePayer(p.key, { name: e.target.value })}
                        maxLength={80}
                        aria-label={`Payer ${i + 1} name`}
                      />
                      <div className="relative w-32">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                        <Input
                          inputMode="decimal"
                          placeholder="Share"
                          value={p.amount}
                          onChange={(e) => updatePayer(p.key, { amount: e.target.value })}
                          className="pl-7 tabular-nums"
                          aria-label={`Payer ${i + 1} share`}
                        />
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        inputMode="tel"
                        placeholder="WhatsApp / phone"
                        value={p.phone}
                        onChange={(e) => updatePayer(p.key, { phone: e.target.value })}
                        aria-label={`Payer ${i + 1} phone`}
                      />
                      <Input
                        inputMode="email"
                        placeholder="Email (optional)"
                        value={p.email}
                        onChange={(e) => updatePayer(p.key, { email: e.target.value })}
                        aria-label={`Payer ${i + 1} email`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePayer(p.key)}
                        disabled={payers.length <= 1}
                        aria-label={`Remove payer ${i + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPayer} disabled={payers.length >= MAX_PAYERS}>
                <Plus className="mr-1.5 size-3.5" /> Add another payer
              </Button>
            </div>

            {/* ---- Live counter ---- */}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
                remainingPaise === 0 && totalPaise >= 100
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : remainingPaise < 0
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/40 text-foreground"
              )}
            >
              <span>
                Assigned <span className="font-semibold tabular-nums">{formatPaise(assignedPaise)}</span> of{" "}
                <span className="font-semibold tabular-nums">{formatPaise(totalPaise)}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {remainingPaise === 0 && totalPaise >= 100 ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-4" /> All assigned
                  </span>
                ) : remainingPaise > 0 ? (
                  `${formatPaise(remainingPaise)} left`
                ) : (
                  `${formatPaise(-remainingPaise)} over`
                )}
              </span>
            </div>
            {problems.length > 0 && payers.some((p) => p.name || p.amount) && (
              <p className="text-xs text-muted-foreground">{problems[0]}</p>
            )}

            <DialogFooter>
              <Button onClick={handleCreate} disabled={!canCreate} className="w-full sm:w-auto">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
                {saving ? "Creating links…" : `Create ${payers.length} payment link${payers.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {created.map((s) => (
                <div key={s.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.payerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.payerPhone || s.payerEmail || "No contact given"}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatPaise(s.amountPaise)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input value={s.url} readOnly className="h-8 flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={() => copy(s.url, s.id)} aria-label="Copy link">
                      {copiedId === s.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                      aria-label="Share on WhatsApp"
                      onClick={() => window.open(whatsAppShareHref(s.payerPhone, waText(s)), "_blank", "noopener")}
                    >
                      <MessageCircle className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => copy(allLinksText, "__all")}>
                {copiedId === "__all" ? <Check className="mr-2 size-4 text-emerald-600" /> : <Copy className="mr-2 size-4" />}
                Copy all links
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
