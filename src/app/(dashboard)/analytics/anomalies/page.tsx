import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShieldAlert } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getAnomalies, getAnomalyStats } from "@/actions/anomaly.actions";
import { PageHeader } from "@/components/layout/page-header";
import { AnomalyDashboard } from "./_components/anomaly-dashboard";

export const metadata: Metadata = {
  title: "Anomaly Detection",
  description: "AI-powered anomaly alerts for your business metrics",
};

// ============================================================
// Anomaly Detection Page (Server Component)
// ============================================================

export default async function AnomaliesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!hasPermission(session.user.role as string, "analytics:read")) {
    redirect("/not-authorized");
  }

  const [anomaliesResult, statsResult] = await Promise.all([
    getAnomalies(),
    getAnomalyStats(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Analytics · Signals"
        icon={ShieldAlert}
        accent="rose"
        title="Anomaly Detection"
        description="AI-powered alerts that surface unusual movement in your business metrics before it costs you."
      />
      <AnomalyDashboard
        anomalies={anomaliesResult.success ? anomaliesResult.data : []}
        stats={statsResult.success ? statsResult.data : null}
      />
    </div>
  );
}
