import type { Metadata } from "next";
import { getCurrencies } from "@/actions/currency.actions";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyManager } from "./_components/currency-manager";

export const metadata: Metadata = { title: "Multi-Currency | Settings" };

// ============================================================
// Multi-Currency Settings Page
// ============================================================

export default async function CurrencySettingsPage() {
  const result = await getCurrencies();
  const currencies = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Currency"
        description="Manage currencies and exchange rates for international bookings."
      />
      <CurrencyManager currencies={currencies} />
    </div>
  );
}
