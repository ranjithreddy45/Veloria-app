import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { getVendorEvents } from "@/actions/vendor-portal.actions";
import { VendorEventsClient } from "./vendor-events-client";

export const metadata: Metadata = { title: "My Events | Vendor Portal" };

// ============================================================
// Vendor Events Page (Server Component)
// ============================================================

export default async function VendorEventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getVendorEvents({ page: 1, limit: 20 });

  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="size-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            My Events
          </h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.error}
          </p>
        </div>
      </div>
    );
  }

  return <VendorEventsClient initialData={result.data} />;
}
