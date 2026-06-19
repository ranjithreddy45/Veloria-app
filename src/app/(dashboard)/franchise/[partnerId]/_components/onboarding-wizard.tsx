"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  saveOnboardingStep,
  completeOnboarding,
  attachVenueToPartner,
  detachVenue,
} from "@/actions/franchise.actions";

// ============================================================
// Onboarding wizard — multi-step, resumes from onboardingStep.
// Each step persists into onboardingData JSON via saveOnboardingStep().
// ============================================================

const STEPS = [
  "Identity",
  "KYC / Legal",
  "Bank / Payout",
  "Venues",
  "Revenue share",
  "Review",
] as const;

interface AttachableVenue {
  id: string;
  name: string;
  capacity?: number;
}
interface AttachedVenue {
  id: string; // franchiseVenue id
  venueId: string;
  name: string;
}

interface OnboardingWizardProps {
  partnerId: string;
  status: string;
  initialStep: number;
  initialData: Record<string, unknown>;
  attachableVenues: AttachableVenue[];
  attachedVenues: AttachedVenue[];
}

type Section = Record<string, string>;

function asSection(v: unknown): Section {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Section)
    : {};
}

export function OnboardingWizard({
  partnerId,
  status,
  initialStep,
  initialData,
  attachableVenues,
  attachedVenues,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(
    Math.min(Math.max(initialStep, 0), STEPS.length - 1)
  );
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const [identity, setIdentity] = React.useState<Section>(
    asSection(initialData.identity)
  );
  const [legal, setLegal] = React.useState<Section>(asSection(initialData.legal));
  const [bank, setBank] = React.useState<Section>(asSection(initialData.bank));
  const [revshareIntent, setRevshareIntent] = React.useState<Section>(
    asSection(initialData.revshareIntent)
  );

  // Venue attach state
  const [selectedVenue, setSelectedVenue] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);

  const isActive = status === "ACTIVE";

  async function persist(stepIndex: number, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const result = await saveOnboardingStep(partnerId, {
        step: stepIndex,
        data,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save");
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  function dataForStep(s: number): Record<string, unknown> {
    switch (s) {
      case 0:
        return { identity };
      case 1:
        return { legal };
      case 2:
        return { bank };
      case 4:
        return { revshareIntent };
      default:
        return {};
    }
  }

  async function goNext() {
    const ok = await persist(step + 1, dataForStep(step));
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleAttach() {
    if (!selectedVenue) {
      toast.error("Pick a venue to attach");
      return;
    }
    setAttaching(true);
    try {
      const result = await attachVenueToPartner({
        partnerId,
        venueId: selectedVenue,
        storefrontConfig: {},
        isStorefrontLive: false,
      });
      if (result.success) {
        toast.success("Venue attached");
        setSelectedVenue("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to attach venue");
      }
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetach(franchiseVenueId: string) {
    const result = await detachVenue(franchiseVenueId);
    if (result.success) {
      toast.success("Venue detached");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to detach venue");
    }
  }

  async function handleComplete() {
    // persist the final review step first
    await persist(STEPS.length - 1, { revshareIntent });
    setCompleting(true);
    try {
      const result = await completeOnboarding(partnerId);
      if (result.success) {
        toast.success("Onboarding complete — partner is now ACTIVE.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Onboarding incomplete");
      }
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  current
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full border border-current text-[10px] tabular-nums">
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="size-3 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-border bg-card p-5">
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Partner identity</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Display name"
                value={identity.displayName ?? ""}
                onChange={(v) => setIdentity({ ...identity, displayName: v })}
              />
              <Field
                label="Primary contact"
                value={identity.contactName ?? ""}
                onChange={(v) => setIdentity({ ...identity, contactName: v })}
              />
              <Field
                label="Email"
                value={identity.email ?? ""}
                onChange={(v) => setIdentity({ ...identity, email: v })}
              />
              <Field
                label="Phone"
                value={identity.phone ?? ""}
                onChange={(v) => setIdentity({ ...identity, phone: v })}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">KYC / Legal</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Legal entity name"
                value={legal.legalName ?? ""}
                onChange={(v) => setLegal({ ...legal, legalName: v })}
              />
              <Field
                label="GSTIN"
                value={legal.gstin ?? ""}
                onChange={(v) => setLegal({ ...legal, gstin: v })}
              />
              <Field
                label="PAN"
                value={legal.pan ?? ""}
                onChange={(v) => setLegal({ ...legal, pan: v })}
              />
              <Field
                label="Registered address"
                value={legal.address ?? ""}
                onChange={(v) => setLegal({ ...legal, address: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              KYC details are stored privately and never exposed on the public
              storefront.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Bank / Payout</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Account holder"
                value={bank.accountName ?? ""}
                onChange={(v) => setBank({ ...bank, accountName: v })}
              />
              <Field
                label="Account number"
                value={bank.accountNumber ?? ""}
                onChange={(v) => setBank({ ...bank, accountNumber: v })}
              />
              <Field
                label="IFSC"
                value={bank.ifsc ?? ""}
                onChange={(v) => setBank({ ...bank, ifsc: v })}
              />
              <Field
                label="Bank name"
                value={bank.bankName ?? ""}
                onChange={(v) => setBank({ ...bank, bankName: v })}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Attach venues</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] space-y-1.5">
                <Label>Venue</Label>
                <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a venue…" />
                  </SelectTrigger>
                  <SelectContent>
                    {attachableVenues.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No more venues available.
                      </div>
                    )}
                    {attachableVenues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAttach} disabled={attaching || !selectedVenue}>
                {attaching && <Loader2 className="mr-2 size-4 animate-spin" />}
                Attach
              </Button>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              {attachedVenues.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No venues attached yet.
                </p>
              )}
              {attachedVenues.map((fv) => (
                <div
                  key={fv.id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span>{fv.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDetach(fv.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Revenue-share intent</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Basis</Label>
                <Select
                  value={revshareIntent.basis ?? "GROSS_REVENUE"}
                  onValueChange={(v) =>
                    setRevshareIntent({ ...revshareIntent, basis: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROSS_REVENUE">Gross revenue</SelectItem>
                    <SelectItem value="NET_REVENUE">Net revenue</SelectItem>
                    <SelectItem value="FLAT_FEE">Flat fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Indicative share %"
                value={revshareIntent.sharePct ?? ""}
                onChange={(v) =>
                  setRevshareIntent({ ...revshareIntent, sharePct: v })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This captures intent only. Configure the binding revenue-share rule
              under the Revenue Share tab.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Review</h3>
            <ReviewRow label="Display name" value={identity.displayName} />
            <ReviewRow label="Legal entity" value={legal.legalName} />
            <ReviewRow label="GSTIN" value={legal.gstin} />
            <ReviewRow label="Bank account" value={bank.accountNumber} />
            <ReviewRow label="Venues attached" value={String(attachedVenues.length)} />
            <ReviewRow label="Revenue-share basis" value={revshareIntent.basis} />
            {isActive ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                This partner is already ACTIVE.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Completing requires legal details, bank details and at least one
                venue.
              </p>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" onClick={goBack} disabled={step === 0 || saving}>
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save &amp; continue
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={completing || isActive}>
              {completing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Complete onboarding
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
