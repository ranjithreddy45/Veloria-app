import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { DemoDataButtons } from "./_components/demo-data-buttons";

export const metadata: Metadata = { title: "Demo data" };

export default async function DemoDataPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
    redirect("/not-authorized");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Preview the engagement features"
        description="Add sample Velos points and recent activity to your own account so you can see the points chip, confetti, leaderboard standing, and live activity feed in action. It only touches your account and is fully reversible."
      />
      <DemoDataButtons />
    </div>
  );
}
