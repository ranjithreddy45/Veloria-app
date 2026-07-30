import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, TrendingUp, IndianRupee, Clock } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import {
  getReferralPartners,
  getReferralPortalStats,
} from "@/actions/referral-portal.actions";
import { listReferralPayouts } from "@/actions/referral-payout.actions";
import { PartnerTable } from "./_components/partner-table";

export const metadata: Metadata = {
  title: "Referral Partners",
};

// ============================================================
// INTERNAL gated partner-portal dashboard (referrals:read)
// ------------------------------------------------------------
// Partner list with code/rollups + the payout ledger (approve/pay gated by
// referrals:rewards). New page — does not touch the existing /referrals pages.
// ============================================================

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function ReferralPartnersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, "referrals:read")) redirect("/dashboard");

  const canManagePayouts = hasPermission(session.user.role, "referrals:rewards");
  const canCreate = hasPermission(session.user.role, "referrals:create");

  const [partnersRes, payoutsRes, statsRes] = await Promise.all([
    getReferralPartners(),
    listReferralPayouts(),
    getReferralPortalStats(),
  ]);

  const partners = (partnersRes.success ? partnersRes.data : []) ?? [];
  const payouts = (payoutsRes.success ? payoutsRes.data : []) ?? [];
  const stats = statsRes.success ? statsRes.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Referrals"
        title="Partner Portal"
        description="Planner & vendor referral partners, their public /refer links, and the auto-accrued payout ledger."
      />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Active partners"
            value={stats.activePartners}
            sub={`${stats.totalPartners} total`}
            accent="gold"
            icon={<Users />}
          />
          <StatTile
            label="Conversion rate"
            value={`${stats.conversionRate}%`}
            sub={`${stats.convertedSubmissions}/${stats.totalSubmissions} submissions`}
            accent="emerald"
            icon={<TrendingUp />}
          />
          <StatTile
            label="Total earned"
            value={inr(stats.totalEarned)}
            sub={`${inr(stats.totalPaid)} paid`}
            accent="blue"
            icon={<IndianRupee />}
          />
          <StatTile
            label="Pending payouts"
            value={stats.pendingPayoutCount}
            sub={inr(stats.pendingPayoutValue)}
            accent="amber"
            icon={<Clock />}
          />
        </div>
      )}

      <PartnerTable
        partners={partners as never}
        payouts={payouts as never}
        canManagePayouts={canManagePayouts}
        canCreate={canCreate}
      />
    </div>
  );
}
