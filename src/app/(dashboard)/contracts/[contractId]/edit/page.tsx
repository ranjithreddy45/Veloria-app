import { notFound, redirect } from "next/navigation";
import {
  getContract,
  getContactsForContract,
  getBookingsForContract,
  getActiveTemplates,
} from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ContractForm } from "../../_components/contract-form";

export const metadata = {
  title: "Edit Contract | Veloria Grand",
};

interface EditContractPageProps {
  params: Promise<{ contractId: string }>;
}

export default async function EditContractPage({
  params,
}: EditContractPageProps) {
  const { contractId } = await params;

  const [contractResult, contactsResult, bookingsResult, templatesResult] =
    await Promise.all([
      getContract(contractId),
      getContactsForContract(),
      getBookingsForContract(),
      getActiveTemplates(),
    ]);

  if (!contractResult.success || !contractResult.data) {
    notFound();
  }

  const contract = contractResult.data;

  if (contract.status !== "DRAFT") {
    redirect(`/contracts/${contractId}`);
  }

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];
  const templates = templatesResult.success ? templatesResult.data ?? [] : [];

  // Transform contract data to form input shape
  const initialData = {
    id: contract.id,
    title: contract.title,
    content: contract.content,
    contactId: contract.contactId ?? contract.contact?.id ?? "",
    bookingId: contract.bookingId ?? contract.booking?.id ?? "",
    templateId: contract.templateId ?? contract.template?.id ?? "",
    signerName: contract.signerName || "",
    signerEmail: contract.signerEmail || "",
    expiresAt: contract.expiresAt ? new Date(contract.expiresAt) : null,
    notes: contract.notes || "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${contract.title}`}
        description="Modify this draft contract."
      />
      <ContractForm
        contacts={contacts}
        bookings={bookings}
        templates={templates}
        initialData={initialData}
        contractId={contractId}
      />
    </div>
  );
}
