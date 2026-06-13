"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createHallOwner, updateHallOwner } from "@/actions/hall-owner.actions";
import type { HallOwnerInput } from "@/schemas/hall-owner.schema";
import { isValidMobile } from "@/lib/acq/domain";

const STATUS = [
  ["PROSPECT", "Prospect"],
  ["CONTACT_MADE", "Contact Made"],
  ["SITE_INSPECTION", "Site Inspection"],
  ["NEGOTIATION", "Negotiation"],
  ["CONTRACT_DRAFTED", "Contract Drafted"],
  ["SIGNED", "Signed"],
  ["ONBOARDED", "Onboarded"],
  ["RENEWAL", "Renewal"],
  ["CHURNED", "Churned"],
] as const;

const MODELS = [
  ["", "—"],
  ["REVENUE_SHARE", "Revenue Share"],
  ["FIXED_LEASE", "Fixed Lease"],
  ["HYBRID", "Hybrid"],
  ["MANAGEMENT_FEE", "Management Fee"],
] as const;

const PROPERTY = [
  ["", "—"],
  ["BANQUET_HALL", "Banquet Hall"],
  ["CONVENTION_CENTER", "Convention Center"],
  ["MARRIAGE_GARDEN", "Marriage Garden"],
  ["MIXED", "Mixed"],
] as const;

const OWNERSHIP = [
  ["", "—"],
  ["SELF_OWNED", "Self-Owned"],
  ["LEASED", "Leased"],
  ["FAMILY_PROPERTY", "Family Property"],
] as const;

type OwnerData = Partial<HallOwnerInput> & { id?: string };

export function OwnerForm({
  owner,
  bdUsers,
}: {
  owner?: OwnerData;
  bdUsers: { id: string; name: string | null }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const isEditing = !!owner?.id;

  const [f, setF] = React.useState({
    ownerName: owner?.ownerName ?? "",
    companyName: owner?.companyName ?? "",
    email: owner?.email ?? "",
    phone: owner?.phone ?? "",
    whatsapp: owner?.whatsapp ?? "",
    gstin: owner?.gstin ?? "",
    propertyCity: owner?.propertyCity ?? "",
    numberOfHalls: owner?.numberOfHalls?.toString() ?? "",
    totalCapacity: owner?.totalCapacity?.toString() ?? "",
    propertyType: (owner?.propertyType as string) ?? "",
    ownershipStatus: (owner?.ownershipStatus as string) ?? "",
    commercialModel: (owner?.commercialModel as string) ?? "",
    revenueSharePercent: owner?.revenueSharePercent?.toString() ?? "",
    minimumMonthlyGuarantee: owner?.minimumMonthlyGuarantee?.toString() ?? "",
    contractStatus: (owner?.contractStatus as string) ?? "PROSPECT",
    bdOwnerId: owner?.bdOwnerId ?? "",
    notes: owner?.notes ?? "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ownerName: f.ownerName,
      companyName: f.companyName || undefined,
      email: f.email || undefined,
      phone: f.phone || undefined,
      whatsapp: f.whatsapp || undefined,
      gstin: f.gstin || undefined,
      propertyCity: f.propertyCity || undefined,
      numberOfHalls: f.numberOfHalls ? Number(f.numberOfHalls) : undefined,
      totalCapacity: f.totalCapacity ? Number(f.totalCapacity) : undefined,
      propertyType: (f.propertyType || undefined) as HallOwnerInput["propertyType"],
      ownershipStatus: (f.ownershipStatus || undefined) as HallOwnerInput["ownershipStatus"],
      commercialModel: (f.commercialModel || undefined) as HallOwnerInput["commercialModel"],
      revenueSharePercent: f.revenueSharePercent ? Number(f.revenueSharePercent) : undefined,
      minimumMonthlyGuarantee: f.minimumMonthlyGuarantee ? Number(f.minimumMonthlyGuarantee) : undefined,
      contractStatus: f.contractStatus as HallOwnerInput["contractStatus"],
      bdOwnerId: f.bdOwnerId || undefined,
      notes: f.notes || undefined,
    };
    const res = isEditing
      ? await updateHallOwner(owner!.id!, payload)
      : await createHallOwner(payload);
    setSaving(false);
    if (res.success) {
      toast.success(isEditing ? "Owner updated" : "Owner added");
      router.push("/owners");
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to save");
    }
  }

  const phoneInvalid = !!f.phone && !isValidMobile(f.phone);

  const input =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const label = "mb-1 block text-[12px] font-medium text-foreground";

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-[14px] font-semibold">Owner & contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Owner name *</label>
            <input className={input} value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} required />
          </div>
          <div>
            <label className={label}>Company</label>
            <input className={input} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={input} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input
              className={input}
              inputMode="tel"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={phoneInvalid}
            />
            {phoneInvalid && <p className="mt-1 text-[12px] text-red-600">Enter a valid phone number (10–15 digits).</p>}
          </div>
          <div>
            <label className={label}>WhatsApp</label>
            <input className={input} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div>
            <label className={label}>GSTIN</label>
            <input className={input} value={f.gstin} onChange={(e) => set("gstin", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-[14px] font-semibold">Property</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>City</label>
            <input className={input} value={f.propertyCity} onChange={(e) => set("propertyCity", e.target.value)} />
          </div>
          <div>
            <label className={label}>Property type</label>
            <select className={input} value={f.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              {PROPERTY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Number of halls</label>
            <input className={input} type="number" value={f.numberOfHalls} onChange={(e) => set("numberOfHalls", e.target.value)} />
          </div>
          <div>
            <label className={label}>Total capacity</label>
            <input className={input} type="number" value={f.totalCapacity} onChange={(e) => set("totalCapacity", e.target.value)} />
          </div>
          <div>
            <label className={label}>Ownership status</label>
            <select className={input} value={f.ownershipStatus} onChange={(e) => set("ownershipStatus", e.target.value)}>
              {OWNERSHIP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-[14px] font-semibold">Commercials & funnel</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Funnel stage</label>
            <select className={input} value={f.contractStatus} onChange={(e) => set("contractStatus", e.target.value)}>
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Commercial model</label>
            <select className={input} value={f.commercialModel} onChange={(e) => set("commercialModel", e.target.value)}>
              {MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Revenue share %</label>
            <input className={input} type="number" value={f.revenueSharePercent} onChange={(e) => set("revenueSharePercent", e.target.value)} />
          </div>
          <div>
            <label className={label}>Min monthly guarantee (₹)</label>
            <input className={input} type="number" value={f.minimumMonthlyGuarantee} onChange={(e) => set("minimumMonthlyGuarantee", e.target.value)} />
          </div>
          <div>
            <label className={label}>BD owner</label>
            <select className={input} value={f.bdOwnerId} onChange={(e) => set("bdOwnerId", e.target.value)}>
              <option value="">Unassigned</option>
              {bdUsers.map((u) => <option key={u.id} value={u.id}>{u.name ?? "User"}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>Notes</label>
          <textarea className={input} rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={saving || !f.ownerName || phoneInvalid}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Save changes" : "Add owner"}
        </button>
      </div>
    </form>
  );
}
