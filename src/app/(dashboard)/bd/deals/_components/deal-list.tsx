"use client";

import { useRouter } from "next/navigation";
import { Handshake } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACQ_DEAL_STAGE_LABEL, type AcqDealStage } from "@/lib/acq/constants";
import type { AcqDealCard } from "./deal-board";

// Stage → hue (kept in sync with the board card colours).
const STAGE_HUE: Record<AcqDealStage, Parameters<typeof StatusPill>[0]["hue"]> = {
  QUALIFIED: "cyan",
  EVALUATION: "blue",
  EVALUATION_COMPLETED: "indigo",
  PROPOSAL_SENT: "violet",
  NEGOTIATION: "amber",
  CONTRACT_SENT: "orange",
  SIGNED: "teal",
  WON: "emerald",
  LOST: "red",
  ON_HOLD: "slate",
};

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function fmtValue(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? INR.format(n) : "—";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function DealList({ deals }: { deals: AcqDealCard[] }) {
  const router = useRouter();

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <Handshake className="size-6 text-muted-foreground" />
        <p className="text-body font-medium text-foreground">No deals</p>
        <p className="max-w-sm text-detail text-muted-foreground">
          Qualify a lead to start a new acquisition deal.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {["Deal", "Owner", "Property", "Stage", "Value", "BD Exec", "Updated"].map(
              (h, i) => (
                <TableHead
                  key={h}
                  className={
                    "text-meta uppercase tracking-[0.04em] text-muted-foreground" +
                    (i === 4 ? " text-right" : "")
                  }
                >
                  {h}
                </TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d) => {
            const stage = d.stage;
            const place = [d.city, d.locality].filter(Boolean).join(" · ");
            return (
              <TableRow
                key={d.id}
                onClick={() => router.push(`/bd/deals/${d.id}`)}
                className="cursor-pointer"
              >
                <TableCell>
                  <span className="text-body font-medium text-foreground">{d.name}</span>
                </TableCell>
                <TableCell className="text-detail text-muted-foreground">
                  {d.ownerName || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-detail text-foreground">{d.propertyName}</span>
                    {place && (
                      <span className="text-meta text-muted-foreground">{place}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill
                    label={ACQ_DEAL_STAGE_LABEL[stage]}
                    hue={STAGE_HUE[stage]}
                    size="xs"
                  />
                </TableCell>
                <TableCell className="text-right text-detail tabular-nums text-foreground">
                  {fmtValue(d.projectedFeeValue)}
                </TableCell>
                <TableCell className="text-detail text-muted-foreground">
                  {d.bdExecutive?.name ?? "Unassigned"}
                </TableCell>
                <TableCell className="text-detail text-muted-foreground">
                  {fmtDate(d.updatedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
