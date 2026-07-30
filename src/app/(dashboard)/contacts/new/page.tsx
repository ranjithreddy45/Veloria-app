import type { Metadata } from "next";
import { ContactIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getVenues } from "@/actions/booking.actions";
import { ContactForm } from "../_components/contact-form";

export const metadata: Metadata = { title: "New Contact" };

// ============================================================
// Create Contact Page
// ============================================================

export default async function NewContactPage() {
  const venuesResult = await getVenues({ activeOnly: true });
  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ id: v.id, name: v.name }))
    : [];

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
        <ContactForm venues={venues} />
      </div>
    </div>
  );
}
