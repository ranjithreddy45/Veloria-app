import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FileSignatureIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { listOffers } from "@/actions/recruit-offer-letter.actions";
import { OffersTable } from "./_components/offers-table";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "recruit:read")) redirect("/recruitment");

  const offers = await listOffers();
  const total = offers.length;

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        icon={FileSignatureIcon}
        accent="violet"
        title="Offer Letters"
        eyebrow={`Hiring · ${total} offer${total === 1 ? "" : "s"}`}
        description="Generate and print branded offer letters for every candidate offer — merged from your HR letter templates."
      />
      <OffersTable offers={offers} />
    </div>
  );
}
