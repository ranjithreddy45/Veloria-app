"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  SearchIcon,
  ClockIcon,
  BadgeCheckIcon,
  SendIcon,
  Building2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { enrollAccountReengage } from "@/actions/corporate-account.actions";
import { CORPORATE_TIER_COLORS } from "./tier-colors";

// ============================================================
// Types
// ============================================================

export interface AccountRow {
  id: string;
  accountName: string;
  tier: string;
  lastEventDate: string | null;
  nextReengageAt: string | null;
  pastEventCount: number;
  upcomingEventCount: number;
  lifetimeRevenue: number;
  lockedPricePerPlate: number | null;
  committedEventsPerYear: number;
  ownerName: string | null;
  isDue: boolean;
  hasCommitment: boolean;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
  } | null;
}

interface AccountWorklistProps {
  rows: AccountRow[];
}

const TIERS = ["ALL", "PROSPECT", "ACTIVE", "KEY", "DORMANT", "CHURNED"] as const;

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ============================================================
// Component
// ============================================================

export function AccountWorklist({ rows }: AccountWorklistProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [tier, setTier] = React.useState<string>("ALL");
  const [dueOnly, setDueOnly] = React.useState(false);
  const [enrolling, setEnrolling] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tier !== "ALL" && r.tier !== tier) return false;
      if (dueOnly && !r.isDue) return false;
      if (q) {
        const hay = [
          r.accountName,
          r.contact?.company ?? "",
          r.contact?.firstName ?? "",
          r.contact?.lastName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, tier, dueOnly]);

  async function handleEnroll(id: string) {
    setEnrolling(id);
    try {
      const res = await enrollAccountReengage(id);
      if (res.success) {
        toast.success(
          res.data.alreadyEnrolled
            ? "Account already enrolled in the re-engage cadence"
            : "Account enrolled in the re-engage cadence"
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search account or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "ALL" ? "All tiers" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={dueOnly ? "default" : "outline"}
          onClick={() => setDueOnly((v) => !v)}
          className="gap-1.5"
        >
          <ClockIcon className="size-4" />
          Due to re-engage
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Lifetime</TableHead>
              <TableHead className="text-center">Past</TableHead>
              <TableHead className="text-center">Upcoming</TableHead>
              <TableHead>Last event</TableHead>
              <TableHead>Re-engage</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  <Building2Icon className="mx-auto mb-2 size-6 opacity-40" />
                  No corporate accounts match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/accounts/${r.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {r.accountName}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {r.contact
                        ? `${r.contact.firstName} ${r.contact.lastName}`
                        : "—"}
                      {r.hasCommitment && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600">
                          <BadgeCheckIcon className="size-3" />
                          {r.committedEventsPerYear > 0
                            ? `${r.committedEventsPerYear}/yr`
                            : "locked"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.tier} colorMap={CORPORATE_TIER_COLORS} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {inr(r.lifetimeRevenue)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{r.pastEventCount}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {r.upcomingEventCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.lastEventDate ? format(new Date(r.lastEventDate), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    {r.isDue ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        <ClockIcon className="size-3" /> Due
                      </span>
                    ) : r.nextReengageAt ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.nextReengageAt), "dd MMM")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.ownerName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={enrolling === r.id || r.tier === "CHURNED"}
                      onClick={() => handleEnroll(r.id)}
                    >
                      <SendIcon className="size-3.5" />
                      {enrolling === r.id ? "Enrolling…" : "Re-engage"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
