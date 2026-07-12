import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { auth } from "@/../auth";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listMyReimbursements } from "@/actions/hr-reimbursement.actions";
import { REIMBURSEMENT_CATEGORIES } from "@/lib/hr/reimbursement";
import { NewReimbursementButton } from "./_components/new-reimbursement-button";
import { MyReimbursementsList } from "./_components/my-reimbursements-list";

export const metadata: Metadata = { title: "My Reimbursements" };

// ============================================================
// Employee self-service — "My Reimbursements".
// ------------------------------------------------------------
// Lives outside the hr:read-gated /people tree so an ordinary employee can raise
// and track their own expense claims. Self-scoped: listMyReimbursements() resolves
// the signed-in user → their Employee row. HR approvals/pay-run disbursement stay
// under /people/payroll with their own permission guards.
// ============================================================

export default async function MyReimbursementsPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!session?.user?.id) notFound();

  const claims = await listMyReimbursements();

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Receipt}
        accent="emerald"
        eyebrow="My space"
        title="My reimbursements"
        description="Claim back approved out-of-pocket expenses — travel, medical, telephone and more. Attach the bill, and track each claim from submitted to paid."
      >
        <NewReimbursementButton categories={REIMBURSEMENT_CATEGORIES} />
      </PageHeader>

      <MyReimbursementsList claims={claims} />
    </div>
  );
}
