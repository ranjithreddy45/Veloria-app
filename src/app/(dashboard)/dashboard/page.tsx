import type { Metadata } from "next";
import { getDashboardFullData } from "@/actions/dashboard-full.actions";
import { FullDashboardView } from "./_components/full-dashboard-view";

export const metadata: Metadata = { title: "Dashboard · Veloria Grand" };

export default async function DashboardPage() {
  const fullData = await getDashboardFullData();

  if (!fullData) {
    return (
      <div className="mx-auto max-w-[62ch] py-10 text-white">
        <h1 className="text-2xl font-bold">The team home is not available for this account.</h1>
        <p className="mt-2 text-slate-400">
          Your role does not include the team dashboard. If that is unexpected, ask an administrator to check your role.
        </p>
      </div>
    );
  }

  return <FullDashboardView data={fullData} />;
}
