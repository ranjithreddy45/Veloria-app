import { Download, FileText, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type Hue } from "@/components/shared/status-pill";

// ============================================================
// EmployeePayslips — HR-side payslip history on the profile.
// ------------------------------------------------------------
// Presentational server component. All money/day figures arrive
// pre-converted to plain numbers from the page (Decimals are never
// carried across as Prisma objects). Renders one card per slip with
// a Download link to the branded PDF route, which independently
// enforces access (hr:payroll OR the owner).
//
// DRAFT visibility: an hr:payroll admin MAY see slips from a DRAFT
// run, but they are provisional — we mark them clearly and disable
// the download so a draft never looks final.
// ============================================================

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export interface EmployeePayslipRow {
  id: string;
  net: number;
  gross: number;
  paidDays: number;
  lopDays: number;
  createdAt: string;
  run: {
    fy: string;
    month: number;
    label: string | null;
    // HrPayrollRun.status is a plain String column (DRAFT | LOCKED | PAID), so
    // Prisma hands us `string`. Keep it wide here and fail safe below rather
    // than casting at the call site.
    status: string;
  };
}

/** Only PAID/LOCKED count as final; anything unrecognised falls back to Draft,
 *  so an unknown status can never be presented as a finalised payslip. */
function statusChip(status: string): { label: string; hue: Hue } {
  if (status === "PAID") return { label: "Paid", hue: "emerald" };
  if (status === "LOCKED") return { label: "Finalised", hue: "teal" };
  return { label: "Draft", hue: "amber" };
}

export function EmployeePayslips({ payslips }: { payslips: EmployeePayslipRow[] }) {
  if (payslips.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No payslips yet"
          description="No payslips yet — they'll appear once a payroll run is finalised."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {payslips.map((p) => {
        const label = p.run.label || `${MONTHS[(p.run.month - 1 + 12) % 12]} ${p.run.fy}`;
        const chip = statusChip(p.run.status);
        const isDraft = p.run.status === "DRAFT";
        return (
          <Card key={p.id} className="gap-4 p-5 shadow-card transition-shadow hover:shadow-card-hover">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">{label}</div>
                <div className="numeric mt-0.5 text-[12px] text-muted-foreground">FY {p.run.fy}</div>
              </div>
              <StatusPill label={chip.label} hue={chip.hue} size="xs" />
            </div>

            <div className="mt-auto">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Net pay</div>
              <div className="numeric mt-1 text-[26px] font-semibold leading-none">{inr.format(p.net)}</div>
              <div className="numeric mt-2 text-[11.5px] text-muted-foreground">
                Gross {inr.format(p.gross)} · {p.paidDays} paid
                {p.lopDays > 0 ? ` · ${p.lopDays} LOP` : ""}
              </div>
            </div>

            {isDraft ? (
              <div>
                <Button variant="outline" size="sm" className="w-full gap-1.5" disabled>
                  <Lock className="size-4" /> Draft — not downloadable
                </Button>
                <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">
                  Provisional figures from an unfinalised run.
                </p>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                <a href={`/api/hr/payslips/${p.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" /> Download
                </a>
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
