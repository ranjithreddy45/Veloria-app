import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getMyCompOffs, getCompOffAdmin } from "@/actions/hr-compoff.actions";
import { CompOffHome } from "./_components/comp-off-home";

export const metadata: Metadata = { title: "Comp-off" };

export default async function CompOffPage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canManage = hasPermission(role, "hr:write");

  const [mine, admin] = await Promise.all([
    getMyCompOffs(),
    canManage ? getCompOffAdmin() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Leave"
          title="Comp-off"
          description="Worked a holiday or weekend? That day is banked as a comp-off you can take off later. HR grants them; you redeem when you want the day back."
        />
        <Button variant="outline" asChild className="gap-1.5">
          <Link href="/people/leave"><CalendarDays className="size-4" /> Back to Leave</Link>
        </Button>
      </div>

      <CompOffHome
        mine={mine as never}
        admin={admin as never}
        canManage={canManage}
      />
    </div>
  );
}
