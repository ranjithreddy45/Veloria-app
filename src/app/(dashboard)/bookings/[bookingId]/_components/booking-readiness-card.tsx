import { CheckCircle2, AlertCircle, ShieldCheckIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ============================================================
// Booking readiness checklist (poka-yoke)
// ------------------------------------------------------------
// Purely informational mistake-proofing aid. Renders a green check or an
// amber cross for each go-live signal we can derive from the data the
// booking page already loads. Never blocks anything — rows it cannot
// evaluate are simply omitted by the caller.
// ============================================================

export interface BookingReadinessCardProps {
  // BEO status string ("DRAFT" | "PUBLISHED" | "LOCKED") if a BEO exists,
  // or null when none has been created / we can't evaluate it.
  beoStatus?: string | null;
  // Whether any invoice still carries a balance due. Pass null to omit.
  hasBalanceDue?: boolean | null;
  // Whether an invoice exists at all (so "no balance due" isn't a false green
  // when nothing has been billed yet).
  hasInvoices?: boolean | null;
  guestCount?: number | null;
  eventDate?: Date | string | null;
}

type Row = { label: string; ok: boolean; hint: string };

export function BookingReadinessCard({
  beoStatus,
  hasBalanceDue,
  hasInvoices,
  guestCount,
  eventDate,
}: BookingReadinessCardProps) {
  const rows: Row[] = [];

  // BEO published or locked.
  if (beoStatus !== undefined) {
    const ok = beoStatus === "PUBLISHED" || beoStatus === "LOCKED";
    rows.push({
      label: "BEO published or locked",
      ok,
      hint: ok
        ? "Banquet event order is finalised"
        : beoStatus
          ? "BEO is still a draft"
          : "No BEO created yet",
    });
  }

  // Final payment cleared (no balance due) — only meaningful once billed.
  if (hasBalanceDue !== undefined && hasBalanceDue !== null) {
    const ok = hasInvoices ? !hasBalanceDue : false;
    rows.push({
      label: "Final payment cleared",
      ok,
      hint: !hasInvoices
        ? "No invoice raised yet"
        : ok
          ? "No balance due"
          : "Balance still outstanding",
    });
  }

  // Guest count set.
  if (guestCount !== undefined && guestCount !== null) {
    const ok = Number(guestCount) > 0;
    rows.push({
      label: "Guest count set",
      ok,
      hint: ok ? `${Number(guestCount)} guests` : "Guest count not set",
    });
  }

  // Event date set.
  if (eventDate !== undefined && eventDate !== null) {
    const parsed = eventDate ? new Date(eventDate) : null;
    const ok = !!parsed && !Number.isNaN(parsed.getTime());
    rows.push({
      label: "Event date set",
      ok,
      hint: ok ? "Date confirmed" : "Event date missing",
    });
  }

  // Nothing we could evaluate — render nothing.
  if (rows.length === 0) return null;

  const clearedCount = rows.filter((r) => r.ok).length;

  return (
    <Card className="border-l-4 border-l-[var(--primary)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-[var(--primary)]" />
            Readiness checklist
          </span>
          <span className="text-muted-foreground text-xs font-normal tabular-nums">
            {clearedCount}/{rows.length} cleared
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-2.5">
              {row.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{row.label}</p>
                <p className="text-muted-foreground text-xs">{row.hint}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Informational only — this does not block any booking action.
        </p>
      </CardContent>
    </Card>
  );
}
