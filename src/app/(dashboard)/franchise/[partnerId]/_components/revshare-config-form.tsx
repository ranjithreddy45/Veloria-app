"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/utils";
import {
  createRevenueShareConfig,
  deactivateRevenueShareConfig,
} from "@/actions/franchise-revshare.actions";

// ============================================================
// Revenue-share config form + list. basis drives which amount field shows.
// ============================================================

interface VenueOpt {
  id: string;
  name: string;
}
interface ConfigRow {
  id: string;
  name: string;
  basis: string;
  sharePct: number;
  flatFeeAmount: number | null;
  currency: string;
  isActive: boolean;
  venue?: { id: string; name: string } | null;
}

interface RevshareConfigFormProps {
  partnerId: string;
  venues: VenueOpt[];
  configs: ConfigRow[];
}

const BASIS_LABELS: Record<string, string> = {
  GROSS_REVENUE: "Gross revenue",
  NET_REVENUE: "Net revenue",
  FLAT_FEE: "Flat fee",
};

const ACTIVE_COLORS: Record<string, string> = {
  Active:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  Inactive: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
};

export function RevshareConfigForm({
  partnerId,
  venues,
  configs,
}: RevshareConfigFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [name, setName] = React.useState("");
  const [basis, setBasis] = React.useState("GROSS_REVENUE");
  const [sharePct, setSharePct] = React.useState("");
  const [flatFeeAmount, setFlatFeeAmount] = React.useState("");
  const [venueId, setVenueId] = React.useState("__all__");
  const [isActive, setIsActive] = React.useState(true);

  function reset() {
    setName("");
    setBasis("GROSS_REVENUE");
    setSharePct("");
    setFlatFeeAmount("");
    setVenueId("__all__");
    setIsActive(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createRevenueShareConfig({
        partnerId,
        name: name.trim(),
        basis: basis as "GROSS_REVENUE" | "NET_REVENUE" | "FLAT_FEE",
        sharePct: basis === "FLAT_FEE" ? 0 : Number(sharePct || 0),
        flatFeeAmount: basis === "FLAT_FEE" ? Number(flatFeeAmount || 0) : null,
        currency: "INR",
        isActive,
        venueId: venueId === "__all__" ? null : venueId,
      });
      if (result.success) {
        toast.success("Config created");
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to create config");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    const result = await deactivateRevenueShareConfig(id);
    if (result.success) {
      toast.success("Config deactivated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Revenue-share configs</h3>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="mr-1.5 size-3.5" />
          {open ? "Close" : "New config"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard 15% gross"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Basis</Label>
              <Select value={basis} onValueChange={setBasis}>
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

            {basis === "FLAT_FEE" ? (
              <div className="space-y-1.5">
                <Label>Flat fee amount (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={flatFeeAmount}
                  onChange={(e) => setFlatFeeAmount(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Share % *</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={sharePct}
                  onChange={(e) => setSharePct(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All venues (partner-wide)</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="rs-active" />
            <Label htmlFor="rs-active">Active</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save config
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Basis</th>
              <th className="px-4 py-2.5 font-medium">Rate</th>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                  No configs yet.
                </td>
              </tr>
            )}
            {configs.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5">{BASIS_LABELS[c.basis] ?? c.basis}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {c.basis === "FLAT_FEE"
                    ? formatINR(c.flatFeeAmount ?? 0)
                    : `${c.sharePct}%`}
                </td>
                <td className="px-4 py-2.5">{c.venue?.name ?? "All venues"}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    status={c.isActive ? "Active" : "Inactive"}
                    colorMap={ACTIVE_COLORS}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {c.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(c.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
