import {
  getContactsForContract,
  getBookingsForContract,
  getActiveTemplates,
} from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ContractForm } from "../_components/contract-form";

export const metadata = {
  title: "New Contract",
};

export default async function NewContractPage() {
  const [contactsResult, bookingsResult, templatesResult] = await Promise.all([
    getContactsForContract(),
    getBookingsForContract(),
    getActiveTemplates(),
  ]);

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];
  const templates = templatesResult.success ? templatesResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contract"
        description="Create a new contract from scratch or from a template."
      />
      <ContractForm
        contacts={contacts}
        bookings={bookings}
        templates={templates}
      />
    </div>
  );
}
