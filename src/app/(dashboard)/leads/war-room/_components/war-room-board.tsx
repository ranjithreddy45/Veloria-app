"use client";

// ============================================================
// WarRoomBoard — the live SLA cockpit grid.
//
// Pure presentation: receives the serialized board rows + tier config as
// props. Each row renders the lead/contact/assignee, a per-lead live
// countdown (SlaCountdown, ticking off the server-provided firstContactDue
// ISO with no server round-trips), a color-coded risk band that recolors
// client-side as the timer crosses thresholds, the current escalation-tier
// badge, and a "Mark responded" action that calls resolveSlaLead().
//
// The server pre-sorts rows most-urgent-first. Once a row is resolved it is
// optimistically hidden, and the page is refreshed to re-pull authoritative
// state. The browser timer is cosmetic only — the cron + getSlaWarRoomBoard
// remain the source of truth for breach decisions.
// ============================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Siren } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { resolveSlaLead } from "@/actions/sla-warroom.actions";
import { SlaCountdown, type LiveRiskBand } from "./sla-countdown";

// ============================================================
// Types (mirror the action's serialized return shape)
// ============================================================

type RiskBand = "OK" | "WARN" | "BREACHED";
type EscalationTier = "NONE" | "WARN_REP" | "ESCALATE_MANAGER" | "ESCALATE_ADMIN";

interface BoardRow {
  leadId: string;
  title: string;
  contactName: string;
  assigneeName: string | null;
  score: number;
  firstContactDue: string | null;
  secondsRemaining: number;
  riskBand: RiskBand;
  escalationTier: EscalationTier;
}

interface WarRoomBoardProps {
  rows: BoardRow[];
  warnMinutes: number;
  generatedAt: string;
}

// ============================================================
// Visual maps
// ============================================================

const BAND_HUE: Record<RiskBand, Hue> = {
  OK: "emerald",
  WARN: "amber",
  BREACHED: "rose",
};

const BAND_LABEL: Record<RiskBand, string> = {
  OK: "On track",
  WARN: "At risk",
  BREACHED: "Breached",
};

const TIER_META: Record<EscalationTier, { label: string; hue: Hue } | null> = {
  NONE: null,
  WARN_REP: { label: "Rep warned", hue: "amber" },
  ESCALATE_MANAGER: { label: "Manager", hue: "orange" },
  ESCALATE_ADMIN: { label: "Admin", hue: "red" },
};

function scoreHue(score: number): Hue {
  if (score >= 70) return "emerald";
  if (score >= 40) return "amber";
  return "slate";
}

// ============================================================
// Row — owns its own live band state so it can recolor independently.
// ============================================================

function WarRoomRowItem({
  row,
  warnMinutes,
  onResolved,
}: {
  row: BoardRow;
  warnMinutes: number;
  onResolved: (leadId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [liveBand, setLiveBand] = React.useState<LiveRiskBand>(row.riskBand);

  const handleBandChange = React.useCallback((b: LiveRiskBand) => {
    setLiveBand(b);
  }, []);

  function handleResolve() {
    startTransition(async () => {
      const res = await resolveSlaLead(row.leadId);
      if (res.success) {
        toast.success("Marked responded — SLA clock stopped");
        onResolved(row.leadId);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const tier = TIER_META[row.escalationTier];

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/leads/${row.leadId}`}
          className="font-medium hover:underline"
        >
          {row.title}
        </Link>
        <div className="text-xs text-muted-foreground">{row.contactName}</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {row.assigneeName ?? "Unassigned"}
      </TableCell>
      <TableCell>
        <StatusPill label={String(row.score)} hue={scoreHue(row.score)} size="xs" noDot />
      </TableCell>
      <TableCell className="text-right">
        <SlaCountdown
          targetIso={row.firstContactDue}
          warnMinutes={warnMinutes}
          onBandChange={handleBandChange}
          className="text-body"
        />
      </TableCell>
      <TableCell>
        <StatusPill label={BAND_LABEL[liveBand]} hue={BAND_HUE[liveBand]} size="xs" />
      </TableCell>
      <TableCell>
        {tier ? (
          <StatusPill label={tier.label} hue={tier.hue} size="xs" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={handleResolve}
          disabled={pending}
          className="h-7 px-2 text-xs"
        >
          <CheckCircle2 className="size-3.5" />
          {pending ? "Saving…" : "Mark responded"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ============================================================
// Board
// ============================================================

export function WarRoomBoard({ rows, warnMinutes, generatedAt }: WarRoomBoardProps) {
  const [resolvedIds, setResolvedIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const handleResolved = React.useCallback((leadId: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(leadId);
      return next;
    });
  }, []);

  const visible = rows.filter((r) => !resolvedIds.has(r.leadId));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Siren className="text-destructive size-4" />
          Live SLA board
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs numeric text-muted-foreground">
            {visible.length}
          </span>
          <span className="ml-auto text-meta font-normal text-muted-foreground">
            Snapshot{" "}
            <span className="numeric">
              {new Date(generatedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {" · countdown live"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {visible.length === 0 ? (
          <EmptyState
            className="py-12"
            tone="success"
            icon={<Siren />}
            title="SLA board is clear"
            description="No open leads on the clock — every enquiry has been responded to in time."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Countdown</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Escalation</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <WarRoomRowItem
                  key={row.leadId}
                  row={row}
                  warnMinutes={warnMinutes}
                  onResolved={handleResolved}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
