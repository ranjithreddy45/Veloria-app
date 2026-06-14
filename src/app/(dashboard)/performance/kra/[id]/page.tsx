import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { getKraScorecard } from "@/actions/kra.actions";
import { getKraTemplate } from "@/lib/kra/templates";
import { KraDetail } from "../_components/kra-detail";

export const metadata: Metadata = { title: "KRA Scorecard" };

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "BD_HEAD", "HR_MANAGER"];

export default async function KraScorecardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { id?: string; role?: string };
  const isManager = !!user.role && MANAGER_ROLES.includes(user.role);

  const res = await getKraScorecard(id);
  if (!res.success) notFound();

  const dto = res.data;
  const template = getKraTemplate(dto.role);
  if (!template) notFound();

  return (
    <KraDetail
      scorecard={dto}
      template={template}
      isManager={isManager}
      currentUserId={user.id ?? ""}
    />
  );
}
