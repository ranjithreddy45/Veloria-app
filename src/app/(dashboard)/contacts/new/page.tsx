import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "../_components/contact-form";

export const metadata: Metadata = { title: "New Contact" };

// ============================================================
// Create Contact Page
// ============================================================

export default function NewContactPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contact"
        description="Add a new contact to your CRM."
      />
      <div className="mx-auto max-w-3xl">
        <ContactForm />
      </div>
    </div>
  );
}
