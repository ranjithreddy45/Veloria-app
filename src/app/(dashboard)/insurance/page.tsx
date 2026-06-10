import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, AlertTriangleIcon, ShieldIcon, IndianRupeeIcon, ClockIcon } from "lucide-react";

import { getInsurancePolicies, getInsuranceStats, getExpiringPolicies } from "@/actions/insurance.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InsuranceTable } from "./_components/insurance-table";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance Policies" };

// ============================================================
// Insurance Policies List Page
// ============================================================

export default async function InsurancePage() {
  const [policiesResult, statsResult, expiringResult] = await Promise.all([
    getInsurancePolicies(),
    getInsuranceStats(),
    getExpiringPolicies(30),
  ]);

  const policies = policiesResult.success ? policiesResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : { totalActive: 0, expiringSoon: 0, totalCoverage: 0, totalPremiums: 0 };
  const expiringPolicies = expiringResult.success ? expiringResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance Policies"
        help={<PageHelp id="insurance" />}
        description="Track and manage insurance policies for events, venues, and bookings."
      >
        <Button asChild>
          <Link href="/insurance/new">
            <PlusIcon className="mr-2 size-4" />
            Add Policy
          </Link>
        </Button>
      </PageHeader>

      {/* Expiring Soon Alert */}
      {expiringPolicies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle>Policies Expiring Soon</AlertTitle>
          <AlertDescription>
            {expiringPolicies.length} insurance{" "}
            {expiringPolicies.length === 1 ? "policy is" : "policies are"}{" "}
            expiring within the next 30 days. Review and renew them promptly.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <ShieldIcon className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <ClockIcon className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.expiringSoon}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
            <IndianRupeeIcon className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatINR(stats.totalCoverage)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Premiums</CardTitle>
            <IndianRupeeIcon className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatINR(stats.totalPremiums)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policies Table */}
      <InsuranceTable data={policies} />
    </div>
  );
}
