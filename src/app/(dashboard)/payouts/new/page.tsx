import {
  getVendorsForPayout,
  getBookingsForPayout,
} from "@/actions/payout.actions";
import { getBillsForPayout } from "@/actions/vendor-bill.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PayoutForm } from "../_components/payout-form";

export const metadata = {
  title: "New Payout",
};

export default async function NewPayoutPage() {
  const [vendorsResult, bookingsResult, bills] = await Promise.all([
    getVendorsForPayout(),
    getBookingsForPayout(),
    getBillsForPayout(),
  ]);

  const vendors = vendorsResult.success ? vendorsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Payout"
        description="Create a new vendor payment, owner payout, or commission."
      />
      <PayoutForm vendors={vendors} bookings={bookings} bills={bills} />
    </div>
  );
}
