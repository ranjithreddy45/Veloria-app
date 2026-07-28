import type { Metadata } from "next";
import { ContactIcon } from "lucide-react";
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
        icon={ContactIcon}
        accent="blue"
        eyebrow="CRM · Contact"
        title="New Contact"
        description="Add a person to your directory — their leads, bookings and history roll up here."
      />
      <div className="mx-auto max-w-3xl">
        <ContactForm />
      </div>
    </div>
  );
}
