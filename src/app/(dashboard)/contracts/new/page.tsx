import {
  getContactsForContract,
  getBookingsForContract,
  getActiveTemplates,
} from "@/actions/contract.actions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ContractForm } from "../_components/contract-form";
import type { ContractInput } from "@/schemas/contract.schema";

export const metadata = {
  title: "New Contract",
};

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;
  const [contactsResult, bookingsResult, templatesResult] = await Promise.all([
    getContactsForContract(),
    getBookingsForContract(),
    getActiveTemplates(),
  ]);

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];
  const templates = templatesResult.success ? templatesResult.data ?? [] : [];

  // "Create Contract" from a booking → pre-fill contact, booking and signer.
  let initialData: (ContractInput & { id?: string }) | undefined;
  if (bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        eventName: true,
        contactId: true,
        contact: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (b) {
      initialData = {
        title: `Contract — ${b.eventName}`,
        content: "",
        contactId: b.contactId,
        bookingId: b.id,
        templateId: "",
        signerName: `${b.contact?.firstName ?? ""} ${b.contact?.lastName ?? ""}`.trim(),
        signerEmail: b.contact?.email ?? "",
        expiresAt: null,
        notes: "",
      };
    }
  }

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
        initialData={initialData}
      />
    </div>
  );
}
