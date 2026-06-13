import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { ComingSoon } from "../_components/coming-soon";

export const metadata: Metadata = { title: "Engagement" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();
  return (
    <ComingSoon
      title="Engagement"
      description="eNPS pulse surveys and recognition analytics."
      bullets={["Anonymous pulse / eNPS", "Sentiment trends by entity/vertical", "Builds on the Kudos recognition layer"]}
    />
  );
}
