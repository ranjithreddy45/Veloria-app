import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listReminderRules } from "@/actions/hr-reminder.actions";
import { RemindersAdmin, type ReminderRule } from "./_components/reminders-admin";

export const metadata: Metadata = { title: "HR Reminders" };

export default async function HrRemindersPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const rules = (await listReminderRules()) as unknown as ReminderRule[];

  return (
    <div className="space-y-6">
      <Link
        href="/people/settings"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> People settings
      </Link>
      <PageHeader
        icon={Bell}
        accent="rose"
        title="HR Reminders"
        description="Automated reminders fired by the daily job."
      />
      <RemindersAdmin rules={rules} />
      <p className="text-detail text-muted-foreground">
        Rules are evaluated by the daily HR cron.
      </p>
    </div>
  );
}
