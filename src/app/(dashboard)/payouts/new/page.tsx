import {
  getVendorsForPayout,
  getBookingsForPayout,
} from "@/actions/payout.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PayoutForm } from "../_components/payout-form";

export const metadata = {
  title: "New Payout | Veloria Grand",
};

export default async function NewPayoutPage() {
  const [vendorsResult, bookingsResult] = await Promise.all([
    getVendorsForPayout(),
    getBookingsForPayout(),
  ]);

  const vendors = vendorsResult.success ? vendorsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Payout"
        description="Create a new vendor payment, owner payout, or commission."
      />
      <PayoutForm vendors={vendors} bookings={bookings} />
    </div>
  );
}
