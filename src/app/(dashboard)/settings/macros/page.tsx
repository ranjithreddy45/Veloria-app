import type { Metadata } from "next";
import { ZapIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MacrosManager } from "./_components/macros-manager";

export const metadata: Metadata = { title: "Macros" };

export default function MacrosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={ZapIcon}
        accent="amber"
        title="Macros"
        description="One-click, multi-step actions for leads, contacts, deals and bookings. Bundle the steps your team repeats all day into a single button."
      />
      <MacrosManager />
    </div>
  );
}
