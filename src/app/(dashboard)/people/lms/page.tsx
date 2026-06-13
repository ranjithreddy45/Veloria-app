import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { ComingSoon } from "../_components/coming-soon";

export const metadata: Metadata = { title: "Learning" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();
  return (
    <ComingSoon
      title="Learning"
      description="Courses, training tracks and completion certificates."
      bullets={["Role-based learning paths", "Onboarding training assignments", "Completion + certificate tracking"]}
    />
  );
}
