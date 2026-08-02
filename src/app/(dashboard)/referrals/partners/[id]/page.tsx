import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PartnerQr } from "@/components/referral-portal/partner-qr";
import { getReferralPartnerById } from "@/actions/referral-portal.actions";

export const metadata: Metadata = {
  title: "Referral Partner",
};

// ============================================================
// INTERNAL gated partner detail (referrals:read)
// ------------------------------------------------------------
// Submissions timeline, conversion status, payout ledger + shareable
// /refer/<code> link & QR.
// ============================================================

interface Submission {
  id: string;
  prospectName: string;
  eventType: string | null;
  eventDate: string | null;
  convertedBookingId: string | null;
  bookingValue: number | null;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  paymentRef: string | null;
  createdAt: string;
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400",
};

export default async function ReferralPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, "referrals:read")) redirect("/dashboard");

  const { id } = await params;
  const res = await getReferralPartnerById(id);
  if (!res.success || !res.data) notFound();

  const partner = res.data as unknown as {
    id: string;
    name: string;
    code: string;
    type: string;
    isActive: boolean;
    submittedCount: number;
    convertedCount: number;
    totalEarned: number;
    totalPaid: number;
    issuedFromReviewId: string | null;
    link: string;
    submissions: Submission[];
    payouts: Payout[];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Referral Partner"
        title={partner.name}
        description={`Code ${partner.code} · ${partner.type}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Share link & QR
              {partner.issuedFromReviewId && (
                <Badge variant="outline" className="text-meta">from review</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PartnerQr link={partner.link} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label="Submitted" value={String(partner.submittedCount)} />
          <StatCard label="Converted" value={String(partner.convertedCount)} />
          <StatCard label="Total earned" value={inr(partner.totalEarned)} />
          <StatCard label="Total paid" value={inr(partner.totalPaid)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Booking value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No submissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                partner.submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.prospectName}</TableCell>
                    <TableCell className="text-sm">
                      {s.eventType || "—"}
                      {s.eventDate ? ` · ${fmtDate(s.eventDate)}` : ""}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(s.createdAt)}</TableCell>
                    <TableCell>
                      {s.convertedBookingId ? (
                        <Badge variant="outline" className={STATUS_STYLE.PAID}>
                          Converted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={STATUS_STYLE.PENDING}>
                          Open
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.bookingValue != null ? inr(s.bookingValue) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payouts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No payouts yet.
                  </TableCell>
                </TableRow>
              ) : (
                partner.payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-right tabular-nums">{inr(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLE[p.status] ?? ""}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.paymentRef ?? "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
