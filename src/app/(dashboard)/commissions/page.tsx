import type { Metadata } from "next";
import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import {
  getCommissionEntries,
  getCommissionRules,
} from "@/actions/commission.actions";
import { getUsers } from "@/actions/user.actions";
import { getBookings } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/lib/utils";
import { CommissionTable } from "./_components/commission-table";
import { CommissionRuleForm } from "./_components/commission-rule-form";
import { CommissionCalcDialog } from "./_components/commission-calc-dialog";
import {
  CommissionStatStrip,
  computeCommissionTotals,
} from "./_components/commission-stats";

export const metadata: Metadata = { title: "Commissions" };

// ============================================================
// Commissions Page
// ============================================================

export default async function CommissionsPage() {
  const [entriesResult, rulesResult, usersResult, bookingsResult] =
    await Promise.all([
      getCommissionEntries(),
      getCommissionRules(),
      getUsers({ limit: 200 }),
      getBookings({ limit: 200 }),
    ]);

  const entries = entriesResult.success ? entriesResult.data : [];
  const rules = rulesResult.success ? rulesResult.data : [];

  // Picker options for the Calculate Commission dialog. These reads are gated
  // by their own permissions (users:read / bookings:read); if the current user
  // lacks them the lists fall back to empty and the dialog simply shows nothing
  // to pick — the action re-validates everything server-side regardless.
  const users = usersResult.success ? usersResult.data.users : [];
  const bookings = bookingsResult.success ? bookingsResult.data.data : [];

  const totals = computeCommissionTotals(entries);

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        title="Commissions"
        eyebrow={`${totals.count} ${totals.count === 1 ? "entry" : "entries"} · ${formatINR(totals.total)} total · ${formatINR(totals.pending)} pending`}
        help={<PageHelp id="commissions" />}
        description="Track commission entries and manage commission rules."
      >
        <Button variant="outline" asChild className="hover-lift">
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
          <div className="flex justify-end">
            <CommissionCalcDialog
              rules={rules.map((r) => ({
                id: r.id,
                name: r.name,
                percentage: Number(r.percentage),
                isActive: r.isActive,
              }))}
              users={users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
              }))}
              bookings={bookings.map((b) => ({
                id: b.id,
                bookingNumber: b.bookingNumber,
                eventName: b.eventName,
                totalAmount: Number(b.totalAmount),
              }))}
            />
          </div>
          <CommissionTable data={entries} />
        </TabsContent>

        <TabsContent value="rules">
          <CommissionRuleForm initialRules={rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
