"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trophy, Target, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  KRA_ROLES,
  KRA_ROLE_LABEL,
  type KraRole,
} from "@/lib/kra/templates";
import {
  getKraEmployees,
  generateKraScorecard,
} from "@/actions/kra.actions";
import {
  fmtPeriod,
  gradeHue,
  statusHue,
  STATUS_LABEL,
} from "./kra-format";

export interface KraScorecardRow {
  id: string;
  employeeId: string;
  employeeName: string | null;
  role: string;
  period: string;
  rampMonth: number;
  status: "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED";
  totalScore: number;
  totalMax: number;
  gatePassed: boolean;
  band: string | null;
  finalPayoutPct: number;
}

function roleLabel(role: string): string {
  return KRA_ROLE_LABEL[role as KraRole] ?? role;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function KraList({
  scorecards,
  isManager,
}: {
  scorecards: KraScorecardRow[];
  isManager: boolean;
  currentUserId: string;
}) {
  const total = scorecards.length;
  const passed = scorecards.filter((s) => s.gatePassed).length;
  const acknowledged = scorecards.filter((s) => s.status === "ACKNOWLEDGED").length;
  const avgScore =
    total > 0 ? Math.round(scorecards.reduce((a, s) => a + s.totalScore, 0) / total) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Scorecards" value={total} accent="indigo" icon={<Target className="size-4" />} />
        <StatTile label="Avg score" value={`${avgScore}/100`} accent="gold" icon={<Trophy className="size-4" />} pct={avgScore} />
        <StatTile label="Gate passed" value={`${passed}/${total || 0}`} accent="emerald" icon={<ShieldCheck className="size-4" />} />
        <StatTile label="Acknowledged" value={acknowledged} accent="teal" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">All scorecards</h2>
            {isManager && <GenerateDialog />}
          </div>

          {total === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Trophy className="size-6" />}
                title="No scorecards yet"
                description={
                  isManager
                    ? "Generate a monthly scorecard for a sales rep to get started."
                    : "Your manager hasn't published a scorecard for you yet."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">Gate</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecards.map((s) => (
                    <tr
                      key={s.id}
                      className="group border-b last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link href={`/performance/kra/${s.id}`} className="font-medium hover:underline">
                          {s.employeeName ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{roleLabel(s.role)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtPeriod(s.period)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="tabular-nums font-medium">
                            {s.totalScore}/{s.totalMax}
                          </span>
                          <StatusPill label={s.band ?? "—"} hue={gradeHue(s.band)} size="xs" noDot />
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          label={s.gatePassed ? "PASS" : "FAIL"}
                          hue={s.gatePassed ? "emerald" : "rose"}
                          size="xs"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill label={STATUS_LABEL[s.status] ?? s.status} hue={statusHue(s.status)} size="xs" />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {Math.round(s.finalPayoutPct * 1000) / 10}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GenerateDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [employees, setEmployees] = React.useState<{ id: string; name: string; role: string }[]>([]);
  const [loadingEmp, setLoadingEmp] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState("");
  const [role, setRole] = React.useState<KraRole>("CORPORATE_SALES");
  const [period, setPeriod] = React.useState(currentPeriod());
  const [rampMonth, setRampMonth] = React.useState("3");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || employees.length > 0) return;
    setLoadingEmp(true);
    getKraEmployees()
      .then((res) => {
        if (res.success) setEmployees(res.data);
        else toast.error(res.error);
      })
      .finally(() => setLoadingEmp(false));
  }, [open, employees.length]);

  async function handleGenerate() {
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast.error("Period must be YYYY-MM");
      return;
    }
    setSubmitting(true);
    const res = await generateKraScorecard({
      employeeId,
      role,
      period,
      rampMonth: Number(rampMonth),
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Scorecard ready");
      setOpen(false);
      router.push(`/performance/kra/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Generate scorecard
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate KRA scorecard</DialogTitle>
          <DialogDescription>
            Pull this rep&apos;s CRM metrics into a monthly scorecard. New hires can be ramped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={loadingEmp}>
              <SelectTrigger>
                <SelectValue placeholder={loadingEmp ? "Loading…" : "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>KRA role / template</Label>
            <Select value={role} onValueChange={(v) => setRole(v as KraRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KRA_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {KRA_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kra-period">Month</Label>
              <Input
                id="kra-period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ramp month</Label>
              <Select value={rampMonth} onValueChange={setRampMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Month 1 (ramp)</SelectItem>
                  <SelectItem value="2">Month 2 (ramp)</SelectItem>
                  <SelectItem value="3">Month 3+ (full)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
