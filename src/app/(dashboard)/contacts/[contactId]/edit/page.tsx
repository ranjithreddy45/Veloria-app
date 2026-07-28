import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContact } from "@/actions/contact.actions";
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
  const result = await getContact(contactId);

  if (!result.success || !result.data) {
    notFound();
  }

  const contact = result.data;

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
        <ContactForm contact={contact} />
      </div>
    </div>
  );
}
