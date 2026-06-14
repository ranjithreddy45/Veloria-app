import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { getMyWorkqueue } from "@/actions/workqueue.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Workqueue } from "./_components/workqueue";

export const metadata: Metadata = { title: "Workqueue" };

export default async function MyWorkPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userName = session.user.name?.split(" ")[0] || "there";

  const data = await getMyWorkqueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workqueue"
        eyebrow="My work · Today & overdue"
        description="Everything assigned to you — tasks, leads and bookings — in one focused worklist."
      />
      {data ? (
        <Workqueue data={data} userName={userName} />
      ) : (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your workqueue.</p>
      )}
    </div>
  );
}
