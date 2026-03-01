import type { Metadata } from "next";
import { MacrosManager } from "./_components/macros-manager";

export const metadata: Metadata = { title: "Macros" };

export default function MacrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Macros</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create one-click multi-step actions for leads, contacts, deals, and
          bookings. Automate repetitive CRM workflows.
        </p>
      </div>
      <MacrosManager />
    </div>
  );
}
