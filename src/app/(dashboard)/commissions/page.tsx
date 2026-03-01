import type { Metadata } from "next";
import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import {
  getCommissionEntries,
  getCommissionRules,
} from "@/actions/commission.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionTable } from "./_components/commission-table";
import { CommissionRuleForm } from "./_components/commission-rule-form";

export const metadata: Metadata = { title: "Commissions | Veloria Grand" };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
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

        <TabsContent value="entries">
          <CommissionTable data={entries} />
        </TabsContent>

        <TabsContent value="rules">
          <CommissionRuleForm initialRules={rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
