import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getRateCard } from "@/actions/project-ratecard.actions";
import { RateCardManager } from "./_components/rate-card-manager";

export const metadata: Metadata = { title: "CapEx Rate Card" };

export default async function RateCardPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "projects:read")) redirect("/projects");
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "projects:manage");

  const items = await getRateCard();

  return (
    <div className="space-y-5">
      <PageHeader
        title="CapEx Rate Card"
        description="The standard Veloria build rates, luxury floors and trade durations that seed every venue's CapEx estimate — and the build timeline they imply."
      />
      <RateCardManager items={items as never} canManage={canManage} />
    </div>
  );
}
