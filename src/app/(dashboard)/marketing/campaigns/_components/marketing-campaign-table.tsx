"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PencilIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/utils";
import { setCampaignSpend } from "@/actions/marketing-campaign.actions";

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  spendToDate: number;
  currency: string;
  isActive: boolean;
  _count?: { attributions: number };
}

interface MarketingCampaignTableProps {
  data: CampaignRow[];
  canManage: boolean;
}

export function MarketingCampaignTable({
  data,
  canManage,
}: MarketingCampaignTableProps) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [spendValue, setSpendValue] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);

  function startEdit(row: CampaignRow) {
    setEditingId(row.id);
    setSpendValue(String(row.spendToDate ?? 0));
  }

  function cancelEdit() {
    setEditingId(null);
    setSpendValue("");
  }

  async function saveSpend(id: string) {
    const parsed = Number(spendValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Spend must be a non-negative number");
      return;
    }
    setSavingId(id);
    try {
      const res = await setCampaignSpend(id, { spendToDate: parsed });
      if (res.success) {
        toast.success("Spend updated");
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No marketing campaigns yet.
        </p>
        {canManage && (
          <Button asChild className="mt-4" size="sm">
            <Link href="/marketing/campaigns/new">Create your first campaign</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>UTM campaign</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isEditing = editingId === row.id;
            const isSaving = savingId === row.id;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.channel}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.utmCampaign || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row._count?.attributions ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isEditing ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={spendValue}
                      onChange={(e) => setSpendValue(e.target.value)}
                      className="ml-auto h-8 w-28 text-right"
                      autoFocus
                    />
                  ) : (
                    formatINR(row.spendToDate)
                  )}
                </TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge>Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!canManage ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : isEditing ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon-sm"
                        onClick={() => saveSpend(row.id)}
                        disabled={isSaving}
                        aria-label="Save spend"
                      >
                        {isSaving ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <CheckIcon className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        aria-label="Cancel"
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(row)}
                      >
                        Link spend
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        asChild
                        aria-label="Edit campaign"
                      >
                        <Link href={`/marketing/campaigns/${row.id}/edit`}>
                          <PencilIcon className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
