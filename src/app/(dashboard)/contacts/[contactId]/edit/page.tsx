import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContact } from "@/actions/contact.actions";
import { getVenues } from "@/actions/booking.actions";
import { PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "../../_components/contact-form";

export const metadata: Metadata = { title: "Edit Contact" };

// ============================================================
// Edit Contact Page
// ============================================================

interface EditContactPageProps {
  params: Promise<{ contactId: string }>;
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { contactId } = await params;
  const [result, venuesResult] = await Promise.all([
    getContact(contactId),
    getVenues({ activeOnly: true }),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const contact = result.data;
  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ id: v.id, name: v.name }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PencilIcon}
        accent="blue"
        eyebrow="CRM · Contact"
        title="Edit Contact"
        description={`Editing ${contact.firstName} ${contact.lastName}`}
      />
      <div className="mx-auto max-w-3xl">
        <ContactForm contact={contact} venues={venues} />
      </div>
    </div>
  );
}
