import type { Metadata } from "next";
import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { listBgvChecks, listBgvCandidates } from "@/actions/recruit-bgv.actions";
import { BgvWorkspace } from "./_components/bgv-workspace";

export const metadata: Metadata = { title: "Background Verification" };

export default async function BgvPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "recruit:read")) redirect("/recruitment");

  const canWrite = hasPermission(role, "recruit:write");
  const [checks, candidates] = await Promise.all([
    listBgvChecks(),
    listBgvCandidates(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShieldCheck}
        accent="emerald"
        title="Background Verification"
        eyebrow="Hiring · BGV"
        description="Track pre-hire background checks — identity, education, employment, criminal, address and reference — from request through to clearance."
      />
      <BgvWorkspace checks={checks} candidates={candidates} canWrite={canWrite} />
    </div>
  );
}
