import type { Metadata } from "next";
import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import {
  getCommissionEntries,
  getCommissionRules,
} from "@/actions/commission.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/lib/utils";
import { CommissionTable } from "./_components/commission-table";
import { CommissionRuleForm } from "./_components/commission-rule-form";
import {
  CommissionStatStrip,
  computeCommissionTotals,
} from "./_components/commission-stats";

export const metadata: Metadata = { title: "Commissions" };

// ============================================================
// Commissions Page
// ============================================================

export default async function CommissionsPage() {
  const [entriesResult, rulesResult] = await Promise.all([
    getCommissionEntries(),
    getCommissionRules(),
  ]);

  const entries = entriesResult.success ? entriesResult.data : [];
  const rules = rulesResult.success ? rulesResult.data : [];

  const totals = computeCommissionTotals(entries);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
        eyebrow={`${totals.count} ${totals.count === 1 ? "entry" : "entries"} · ${formatINR(totals.total)} total · ${formatINR(totals.pending)} pending`}
        help={<PageHelp id="commissions" />}
        description="Track commission entries and manage commission rules."
      >
        <Button variant="outline" asChild>
          <Link href="/settings/commissions">
            <SettingsIcon className="mr-2 size-4" />
            Manage Rules
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <CommissionStatStrip totals={totals} />
          <CommissionTable data={entries} />
        </TabsContent>

        <TabsContent value="rules">
          <CommissionRuleForm initialRules={rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
