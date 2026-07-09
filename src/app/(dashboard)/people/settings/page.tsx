import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getCustomFieldDefs, listOrgConfig } from "@/actions/hr-config.actions";
import { CustomFieldsAdmin, type FieldDef } from "./_components/custom-fields-admin";
import { OrgConfigAdmin, type OrgConfigData } from "./_components/org-config-admin";

export const metadata: Metadata = { title: "People Settings" };

export default async function PeopleSettingsPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const defs = (await getCustomFieldDefs(false)) as unknown as FieldDef[];
  const orgConfig = (await listOrgConfig()) as unknown as OrgConfigData;

  return (
    <div className="space-y-5">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>
      <PageHeader
        title="People settings"
        description="Configure the People platform. Custom fields apply to every employee profile — add as many as you like."
      />
      <OrgConfigAdmin data={orgConfig} />
      <CustomFieldsAdmin defs={defs} />
    </div>
  );
}
