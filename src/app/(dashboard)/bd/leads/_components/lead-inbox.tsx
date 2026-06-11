"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Phone,
} from "lucide-react";

import {
  createAcqLead,
  qualifyAcqLead,
  disqualifyAcqLead,
  updateAcqLead,
} from "@/actions/acq-lead.actions";
import {
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_TYPE_LABEL,
  ACQ_LEAD_SOURCE,
  ACQ_OWNER_TYPE,
  ACQ_DISQUALIFY_REASON,
} from "@/lib/acq/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export type AcqLeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "DISQUALIFIED";

export interface AcqLead {
  id: string;
  ownerName: string;
  mobilePrimary: string;
  propertyName: string;
  propertyType: string;
  city: string;
  locality: string;
  leadSource: string;
  ownerType: string;
  status: AcqLeadStatus;
  contactAttempts: number;
  firstContactDue: string;
  createdAt: string;
  bdExecutive?: { id: string; name: string | null } | null;
}

export interface BdUser {
  id: string;
  name: string | null;
  role: string;
}

interface LeadInboxProps {
  leads: AcqLead[];
  bdUsers: BdUser[];
}

/** Minimal shape we read off a `duplicateOf` payload. */
interface DuplicateLead {
  propertyName?: string;
  locality?: string;
}

// ============================================================
// Helpers
// ============================================================

const STATUS_HUE: Record<
  AcqLeadStatus,
  "slate" | "blue" | "emerald" | "rose"
> = {
  NEW: "slate",
  CONTACTED: "blue",
  QUALIFIED: "emerald",
  DISQUALIFIED: "rose",
};

const STATUS_LABEL: Record<AcqLeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DISQUALIFIED: "Disqualified",
};

const STATUS_TABS: Array<"ALL" | AcqLeadStatus> = [
  "ALL",
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISQUALIFIED",
];

/** Convert an UPPER_SNAKE enum value into a human label. */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function propertyTypeLabel(value: string): string {
  return (
    (ACQ_PROPERTY_TYPE_LABEL as Record<string, string>)[value] ??
    humanizeEnum(value)
  );
}

/** Defensive numeric coercion (fields may arrive as strings/undefined). */
function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** SLA copy for a NEW lead's first-contact deadline. */
function slaCopy(firstContactDue: string): {
  text: string;
  overdue: boolean;
} {
  const due = new Date(firstContactDue).getTime();
  if (!Number.isFinite(due)) return { text: "—", overdue: false };
  const diffMs = due - Date.now();
  if (diffMs <= 0) return { text: "Overdue", overdue: true };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours >= 1) return { text: `${hours}h left`, overdue: false };
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return { text: `${minutes}m left`, overdue: false };
}

// ============================================================
// Lead Inbox
// ============================================================

export function LeadInbox({ leads, bdUsers }: LeadInboxProps) {
  const [activeTab, setActiveTab] = React.useState<"ALL" | AcqLeadStatus>(
    "ALL"
  );
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [qualifyLead, setQualifyLead] = React.useState<AcqLead | null>(null);
  const [logContactLead, setLogContactLead] = React.useState<AcqLead | null>(
    null
  );

  const counts = React.useMemo(() => {
    const base: Record<"ALL" | AcqLeadStatus, number> = {
      ALL: leads.length,
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      DISQUALIFIED: 0,
    };
    for (const lead of leads) base[lead.status] += 1;
    return base;
  }, [leads]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (activeTab !== "ALL" && lead.status !== activeTab) return false;
      if (!q) return true;
      return (
        lead.ownerName.toLowerCase().includes(q) ||
        lead.propertyName.toLowerCase().includes(q) ||
        lead.city.toLowerCase().includes(q)
      );
    });
  }, [leads, activeTab, query]);

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab;
            const label = tab === "ALL" ? "All" : STATUS_LABEL[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors",
                  active
                    ? "border-foreground/15 bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-md px-1 text-[11px] tabular-nums",
                    active
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {counts[tab]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search owner, property, city…"
              className="h-8 w-[230px] pl-8 text-[13px]"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Owner / Property</th>
              <th className="px-3 py-2 font-medium">City · Locality</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">BD Exec</th>
              <th className="px-3 py-2 font-medium">SLA</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No leads match this view.
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onQualify={() => setQualifyLead(lead)}
                  onLogContact={() => setLogContactLead(lead)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        bdUsers={bdUsers}
      />

      <QualifyLeadDialog
        lead={qualifyLead}
        onOpenChange={(open) => {
          if (!open) setQualifyLead(null);
        }}
      />

      <LogContactDialog
        lead={logContactLead}
        onOpenChange={(open) => {
          if (!open) setLogContactLead(null);
        }}
      />
    </div>
  );
}

// ============================================================
// Row
// ============================================================

function LeadRow({
  lead,
  onQualify,
  onLogContact,
}: {
  lead: AcqLead;
  onQualify: () => void;
  onLogContact: () => void;
}) {
  const isTerminal =
    lead.status === "QUALIFIED" || lead.status === "DISQUALIFIED";
  const canLogContact =
    lead.status === "NEW" || lead.status === "CONTACTED";
  const sla = lead.status === "NEW" ? slaCopy(lead.firstContactDue) : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2.5">
        <div className="font-medium text-foreground">{lead.propertyName}</div>
        <div className="text-[12px] text-muted-foreground">
          {lead.ownerName} · {propertyTypeLabel(lead.propertyType)}
        </div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <span className="text-foreground">{lead.city}</span>
        <span className="text-muted-foreground"> · {lead.locality}</span>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {humanizeEnum(lead.leadSource)}
      </td>
      <td className="px-3 py-2.5">
        <StatusPill
          label={STATUS_LABEL[lead.status]}
          hue={STATUS_HUE[lead.status]}
          size="xs"
        />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {lead.bdExecutive?.name ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        {sla ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              sla.overdue
                ? "font-medium text-red-600"
                : "text-muted-foreground"
            )}
          >
            <Clock className="size-3" />
            {sla.text}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center gap-1.5">
          {canLogContact && (
            <Button variant="ghost" size="xs" onClick={onLogContact}>
              <Phone className="size-3.5" />
              Log contact
            </Button>
          )}
          {!isTerminal && (
            <Button variant="outline" size="xs" onClick={onQualify}>
              Qualify
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// Create dialog
// ============================================================

interface CreateFormState {
  ownerName: string;
  mobilePrimary: string;
  mobileAlternate: string;
  email: string;
  propertyName: string;
  propertyType: string;
  city: string;
  locality: string;
  seatingTheatre: string;
  seatingFloating: string;
  leadSource: string;
  ownerType: string;
  bdExecutiveId: string;
}

const EMPTY_FORM: CreateFormState = {
  ownerName: "",
  mobilePrimary: "",
  mobileAlternate: "",
  email: "",
  propertyName: "",
  propertyType: ACQ_PROPERTY_TYPE[0],
  city: "",
  locality: "",
  seatingTheatre: "",
  seatingFloating: "",
  leadSource: ACQ_LEAD_SOURCE[0],
  ownerType: ACQ_OWNER_TYPE[0],
  bdExecutiveId: "",
};

const UNASSIGNED = "__unassigned__";

function CreateLeadDialog({
  open,
  onOpenChange,
  bdUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bdUsers: BdUser[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<CreateFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState<DuplicateLead | null>(null);

  // Reset whenever the dialog (re)opens.
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
      setDuplicate(null);
      setSubmitting(false);
    }
  }, [open]);

  function set<K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const valid =
    form.ownerName.trim() &&
    form.mobilePrimary.trim() &&
    form.propertyName.trim() &&
    form.city.trim() &&
    form.locality.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setDuplicate(null);

    const seatingTheatre = form.seatingTheatre.trim()
      ? toNumber(form.seatingTheatre)
      : undefined;
    const seatingFloating = form.seatingFloating.trim()
      ? toNumber(form.seatingFloating)
      : undefined;

    try {
      const res = await createAcqLead({
        ownerName: form.ownerName.trim(),
        mobilePrimary: form.mobilePrimary.trim(),
        mobileAlternate: form.mobileAlternate.trim() || undefined,
        email: form.email.trim() || undefined,
        propertyName: form.propertyName.trim(),
        propertyType: form.propertyType as (typeof ACQ_PROPERTY_TYPE)[number],
        city: form.city.trim(),
        locality: form.locality.trim(),
        seatingTheatre,
        seatingFloating,
        leadSource: form.leadSource as (typeof ACQ_LEAD_SOURCE)[number],
        ownerType: form.ownerType as (typeof ACQ_OWNER_TYPE)[number],
        bdExecutiveId:
          form.bdExecutiveId && form.bdExecutiveId !== UNASSIGNED
            ? form.bdExecutiveId
            : undefined,
      });

      if (res.success) {
        toast.success("Lead created");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const dup = (res as { duplicateOf?: unknown }).duplicateOf;
      if (dup) {
        setDuplicate(dup as DuplicateLead);
      } else {
        setError(res.error || "Failed to create lead.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <DialogDescription>
            Capture an owner enquiry. We de-duplicate by mobile and by
            property + locality.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 text-[13px]">
          {duplicate && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Already exists:{" "}
                <span className="font-medium">
                  {duplicate.propertyName ?? "this property"}
                </span>
                {duplicate.locality ? `, ${duplicate.locality}` : ""}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name" required>
              <Input
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                placeholder="Ramesh Kumar"
              />
            </Field>
            <Field label="Owner type" required>
              <EnumSelect
                value={form.ownerType}
                onChange={(v) => set("ownerType", v)}
                options={ACQ_OWNER_TYPE}
              />
            </Field>
            <Field label="Primary mobile" required>
              <Input
                value={form.mobilePrimary}
                onChange={(e) => set("mobilePrimary", e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
              />
            </Field>
            <Field label="Alternate mobile">
              <Input
                value={form.mobileAlternate}
                onChange={(e) => set("mobileAlternate", e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="owner@example.com"
              />
            </Field>

            <Field label="Property name" required className="sm:col-span-2">
              <Input
                value={form.propertyName}
                onChange={(e) => set("propertyName", e.target.value)}
                placeholder="Grand Palace Convention"
              />
            </Field>
            <Field label="Property type" required>
              <EnumSelect
                value={form.propertyType}
                onChange={(v) => set("propertyType", v)}
                options={ACQ_PROPERTY_TYPE}
                labelFor={propertyTypeLabel}
              />
            </Field>
            <Field label="Lead source" required>
              <EnumSelect
                value={form.leadSource}
                onChange={(v) => set("leadSource", v)}
                options={ACQ_LEAD_SOURCE}
              />
            </Field>
            <Field label="City" required>
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Hyderabad"
              />
            </Field>
            <Field label="Locality" required>
              <Input
                value={form.locality}
                onChange={(e) => set("locality", e.target.value)}
                placeholder="Banjara Hills"
              />
            </Field>

            <Field label="Seating — theatre">
              <Input
                value={form.seatingTheatre}
                onChange={(e) => set("seatingTheatre", e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>
            <Field label="Seating — floating">
              <Input
                value={form.seatingFloating}
                onChange={(e) => set("seatingFloating", e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>

            <Field label="Assign BD executive" className="sm:col-span-2">
              <Select
                value={form.bdExecutiveId || UNASSIGNED}
                onValueChange={(v) => set("bdExecutiveId", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign to me (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>
                    Assign to me (default)
                  </SelectItem>
                  {bdUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.id} · {humanizeEnum(u.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || submitting}>
              {submitting && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Create lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Qualify dialog
// ============================================================

interface QualifyChecks {
  is_decision_maker: boolean;
  venue_operational_within_60d: boolean;
  open_to_revenue_share_model: boolean;
  no_competitor_exclusivity: boolean;
}

const QUALIFY_FIELDS: Array<{ key: keyof QualifyChecks; label: string }> = [
  { key: "is_decision_maker", label: "Is the decision-maker" },
  {
    key: "venue_operational_within_60d",
    label: "Venue operational within 60 days",
  },
  {
    key: "open_to_revenue_share_model",
    label: "Open to revenue-share model",
  },
  { key: "no_competitor_exclusivity", label: "No competitor exclusivity" },
];

const EMPTY_CHECKS: QualifyChecks = {
  is_decision_maker: false,
  venue_operational_within_60d: false,
  open_to_revenue_share_model: false,
  no_competitor_exclusivity: false,
};

function QualifyLeadDialog({
  lead,
  onOpenChange,
}: {
  lead: AcqLead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [checks, setChecks] = React.useState<QualifyChecks>(EMPTY_CHECKS);
  const [reason, setReason] = React.useState<string>("");
  const [qualifying, setQualifying] = React.useState(false);
  const [disqualifying, setDisqualifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (lead) {
      setChecks(EMPTY_CHECKS);
      setReason("");
      setError(null);
      setQualifying(false);
      setDisqualifying(false);
    }
  }, [lead]);

  const allChecked = QUALIFY_FIELDS.every((f) => checks[f.key]);

  async function handleQualify() {
    if (!lead || !allChecked || qualifying) return;
    setQualifying(true);
    setError(null);
    try {
      const res = await qualifyAcqLead(lead.id, checks);
      if (res.success) {
        toast.success("Lead qualified — deal created");
        onOpenChange(false);
        router.push(`/bd/deals/${res.data.dealId}`);
        return;
      }
      setError(res.error || "Failed to qualify lead.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setQualifying(false);
    }
  }

  async function handleDisqualify() {
    if (!lead || !reason || disqualifying) return;
    setDisqualifying(true);
    setError(null);
    try {
      const res = await disqualifyAcqLead(
        lead.id,
        reason as (typeof ACQ_DISQUALIFY_REASON)[number]
      );
      if (res.success) {
        toast.success("Lead disqualified");
        onOpenChange(false);
        router.refresh();
        return;
      }
      setError(res.error || "Failed to disqualify lead.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDisqualifying(false);
    }
  }

  const busy = qualifying || disqualifying;

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Qualify lead</DialogTitle>
          <DialogDescription>
            {lead
              ? `${lead.propertyName}, ${lead.locality} — ${lead.ownerName}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-[13px]">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid gap-2.5">
            {QUALIFY_FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
              >
                <Checkbox
                  checked={checks[f.key]}
                  onCheckedChange={(v) =>
                    setChecks((prev) => ({ ...prev, [f.key]: v === true }))
                  }
                  disabled={busy}
                />
                <span className="text-foreground">{f.label}</span>
              </label>
            ))}
          </div>

          <Button
            onClick={handleQualify}
            disabled={!allChecked || busy}
            className="gap-1.5"
          >
            {qualifying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            Convert to Deal
          </Button>

          <div className="flex items-center gap-3 text-[11.5px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or disqualify
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            <Label className="text-[12px] text-muted-foreground">
              Disqualify reason
            </Label>
            <div className="flex items-center gap-2">
              <EnumSelect
                value={reason}
                onChange={setReason}
                options={ACQ_DISQUALIFY_REASON}
                placeholder="Select a reason"
                className="flex-1"
              />
              <Button
                variant="destructive"
                onClick={handleDisqualify}
                disabled={!reason || busy}
                className="gap-1.5"
              >
                {disqualifying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                Disqualify
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Log contact dialog
// ============================================================

/** `value` for a <input type="datetime-local"> from a Date (local time). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function LogContactDialog({
  lead,
  onOpenChange,
}: {
  lead: AcqLead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [followupAt, setFollowupAt] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (lead) {
      // Default to tomorrow, same time.
      const next = new Date();
      next.setDate(next.getDate() + 1);
      setFollowupAt(toLocalInputValue(next));
      setError(null);
      setSubmitting(false);
    }
  }, [lead]);

  async function handleSubmit() {
    if (!lead || !followupAt || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateAcqLead(lead.id, {
        status: "CONTACTED",
        nextFollowupAt: new Date(followupAt).toISOString(),
        incrementContactAttempt: true,
      });
      if (res.success) {
        toast.success("Contact logged");
        onOpenChange(false);
        router.refresh();
        return;
      }
      const msg = res.error || "Failed to log contact.";
      setError(msg);
      toast.error(msg);
    } catch {
      const msg = "Something went wrong. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log contact</DialogTitle>
          <DialogDescription>
            {lead
              ? `Record an attempt for ${lead.propertyName} and schedule the next follow-up.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-[13px]">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-[12px] text-muted-foreground">
              Next follow-up <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={followupAt}
              onChange={(e) => setFollowupAt(e.target.value)}
            />
            <p className="text-[11.5px] text-muted-foreground">
              Must be in the future. Logging contact also marks the lead as
              Contacted.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!followupAt || submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            Log contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Small primitives
// ============================================================

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-[12px] text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function EnumSelect({
  value,
  onChange,
  options,
  labelFor = humanizeEnum,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  labelFor?: (value: string) => string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {labelFor(opt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
