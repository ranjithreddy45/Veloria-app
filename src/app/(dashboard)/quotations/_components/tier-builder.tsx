"use client";

// ============================================================
// TierBuilder — turn one approved quotation into a Good-Better-Best /q link.
// ------------------------------------------------------------
// Clones the base quotation's calculator inputs into 2-4 priced sibling tiers
// (the rep only adjusts ONE lever per tier — the per-plate food rate, or the
// hall rate for hall-only quotes), live-previews each grand total via the same
// computeQuotation engine the calculator uses, then:
//   createTierGroup → submitAndApproveTier (each) → publishTierShareLink
// and surfaces the public /q/<token> link. Money is always recomputed from the
// frozen engine — this UI never invents a total.
// ============================================================

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Plus, Trash2, Star, Loader2, Link2, Copy, Check, MessageCircle } from "lucide-react";

import {
  createTierGroup,
  submitAndApproveTier,
  publishTierShareLink,
  type TierSpec,
} from "@/actions/quote-tiers.actions";
import { computeQuotation, type QuotationInput } from "@/lib/sales/quotation-calc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  baseQuotationId: string;
  baseInput: QuotationInput;
  /** APPROVED | SENT required to seed a group. */
  status: string;
  canBuild: boolean;
}

interface DraftTier {
  key: string;
  displayName: string;
  /** The single lever: per-plate food rate (WITH_FOOD) or hall rate (HALL_ONLY). */
  rate: number;
  isRecommended: boolean;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function TierBuilder({ baseQuotationId, baseInput, status, canBuild }: Props) {
  const router = useRouter();
  const hallOnly = baseInput.foodMode === "HALL_ONLY";
  const leverLabel = hallOnly ? "Hall rate / hr (₹)" : "Per-plate rate (₹)";

  // Seed the lever from the base quote, with Good-Better-Best suggestions around it.
  const baseRate = useMemo(() => {
    if (hallOnly) return Math.max(1, Math.round(baseInput.hallRate ?? 5000));
    return Math.max(1, Math.round(baseInput.foodPerPlateOverride ?? 699));
  }, [baseInput, hallOnly]);

  const [tiers, setTiers] = useState<DraftTier[]>(() => [
    { key: "t0", displayName: "Silver", rate: Math.round(baseRate * 0.85), isRecommended: false },
    { key: "t1", displayName: "Gold", rate: baseRate, isRecommended: true },
    { key: "t2", displayName: "Platinum", rate: Math.round(baseRate * 1.25), isRecommended: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<{ url: string; caption: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canSeed = status === "APPROVED" || status === "SENT";

  function inputFor(rate: number): QuotationInput {
    return hallOnly
      ? { ...baseInput, foodMode: "HALL_ONLY", hallRate: rate }
      : { ...baseInput, foodPerPlateOverride: rate };
  }

  function previewTotal(rate: number): number {
    try {
      return computeQuotation(inputFor(rate)).grandTotal;
    } catch {
      return 0;
    }
  }

  function update(key: string, patch: Partial<DraftTier>) {
    setTiers((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }
  function setRecommended(key: string) {
    setTiers((prev) => prev.map((t) => ({ ...t, isRecommended: t.key === key })));
  }
  function addTier() {
    if (tiers.length >= 4) return;
    setTiers((prev) => [
      ...prev,
      { key: `t${Date.now()}`, displayName: `Tier ${prev.length + 1}`, rate: baseRate, isRecommended: false },
    ]);
  }
  function removeTier(key: string) {
    setTiers((prev) => (prev.length <= 2 ? prev : prev.filter((t) => t.key !== key)));
  }

  async function handlePublish() {
    if (!canBuild) return;
    if (tiers.some((t) => !t.rate || t.rate < 1)) {
      toast.error("Every tier needs a positive rate.");
      return;
    }
    setBusy(true);
    try {
      // 1) Build the group (clones base inputs + sets the one lever per tier).
      const specs: TierSpec[] = tiers.map((t, i) => ({
        displayName: t.displayName.trim() || `Tier ${i + 1}`,
        input: inputFor(t.rate),
        isRecommended: t.isRecommended,
      }));
      const group = await createTierGroup(baseQuotationId, specs);
      if (!group.success) {
        toast.error(group.error);
        return;
      }

      // 2) Submit + approve each sibling (segregation of duties enforced server-side).
      const approvals = await Promise.all(
        group.data.quotationIds.map((id) => submitAndApproveTier(id))
      );
      const notApproved = approvals.filter((a) => !a.success);
      if (notApproved.length > 0) {
        toast.message("Tiers created as drafts", {
          description:
            "A sales manager must approve each tier before the link can be published. They'll appear in the approvals queue.",
        });
        router.refresh();
        return;
      }

      // 3) Publish the shared /q link across the approved tiers.
      const pub = await publishTierShareLink(group.data.quoteGroupId, { showSocialProof: true });
      if (!pub.success) {
        toast.error(pub.error);
        return;
      }
      setPublished({ url: pub.data.url, caption: pub.data.caption });
      toast.success("Good-Better-Best link published.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!published) return;
    navigator.clipboard?.writeText(published.url).then(
      () => {
        setCopied(true);
        toast.success("Link copied");
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error("Couldn't copy — select the link manually.")
    );
  }

  return (
    <Card className="border-indigo-200/70 dark:border-indigo-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4 text-indigo-600" />
          Good-Better-Best tiers
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {published ? (
          <div className="space-y-2">
            <p className="text-success text-sm">
              Published — share this one link; the customer compares all tiers and pays the one they pick.
            </p>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
              <Link2 className="size-4 shrink-0 text-indigo-600" />
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{published.url}</span>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2" onClick={copyLink}>
                {copied ? <Check className="text-success size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${published.caption}\n${published.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-3.5 text-green-600" /> Share on WhatsApp
              </a>
            </Button>
          </div>
        ) : !canSeed ? (
          <p className="text-sm text-muted-foreground">
            Approve or send this quotation first — only an approved quote can seed a Good-Better-Best tier group.
          </p>
        ) : !canBuild ? (
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to build quote tiers.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Each tier clones this quote and changes just the {hallOnly ? "hall rate" : "per-plate rate"}. Totals
              recompute live; the recommended tier is highlighted to anchor the deal.
            </p>

            <div className="space-y-2">
              {tiers.map((t) => {
                const total = previewTotal(t.rate);
                return (
                  <div
                    key={t.key}
                    className={`grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-xl border p-3 ${
                      t.isRecommended ? "border-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Tier name</Label>
                      <Input
                        value={t.displayName}
                        onChange={(e) => update(t.key, { displayName: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{leverLabel}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={t.rate}
                        onChange={(e) => update(t.key, { rate: Math.max(0, Number(e.target.value)) })}
                        className="h-8 w-28"
                      />
                    </div>
                    <div className="space-y-1 text-right">
                      <Label className="text-[11px] text-muted-foreground">Grand total</Label>
                      <p className="h-8 text-sm font-semibold leading-8">{total > 0 ? inr(total) : "—"}</p>
                    </div>
                    <div className="flex items-center gap-1 pb-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant={t.isRecommended ? "default" : "ghost"}
                        className="size-8"
                        title="Mark as recommended"
                        onClick={() => setRecommended(t.key)}
                      >
                        <Star className={`size-3.5 ${t.isRecommended ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive disabled:opacity-30"
                        title="Remove tier"
                        disabled={tiers.length <= 2}
                        onClick={() => removeTier(t.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addTier} disabled={tiers.length >= 4}>
                <Plus className="size-3.5" /> Add tier
              </Button>
              <Button onClick={handlePublish} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
                Create &amp; publish link
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
