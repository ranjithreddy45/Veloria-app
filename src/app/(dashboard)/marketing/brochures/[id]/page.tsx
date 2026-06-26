import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import {
  getBrochure,
  getBrochureEditorOptions,
  type BrochureDetail,
} from "@/actions/brochure.actions";
import { BrochureEditor } from "../_components/brochure-editor";

export const metadata: Metadata = {
  title: "Edit brochure",
};

// ============================================================
// Brochure editor (Server Component). Gated by marketing:read; the editor's
// save buttons additionally require marketing:manage server-side. The special
// id "new" renders the editor in create mode.
// ============================================================

export default async function BrochureEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:read")) {
    redirect("/not-authorized");
  }
  const canManage = hasPermission(session.user.role as string, "marketing:manage");

  const isNew = id === "new";

  let brochure: BrochureDetail | null = null;
  if (!isNew) {
    const res = await getBrochure(id);
    if (!res.success) notFound();
    brochure = res.data;
  }

  const optsRes = await getBrochureEditorOptions(brochure?.venueId ?? null);
  const options = optsRes.success
    ? optsRes.data
    : { venues: [], galleryItems: [], reviews: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MARKETING · BROCHURES"
        title={isNew ? "New brochure" : brochure?.title || "Edit brochure"}
        description="Curate proof, set pricing teaser and choose the CTAs surfaced on the public microsite."
      />
      <BrochureEditor brochure={brochure} options={options} canManage={canManage} />
    </div>
  );
}
