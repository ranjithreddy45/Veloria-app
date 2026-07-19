import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { drawMonthKey } from "@/lib/draw";
import { DrawRegister } from "./_components/draw-register";

export const metadata: Metadata = { title: "Guest Draw Register" };

export default async function AdminDrawPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "bookings:read")) redirect("/not-authorized");

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const currentMonth = drawMonthKey(new Date());

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketing"
        title="Guest Draw Register"
        description="Monthly lucky-draw entries captured at the venue — search the register, run the draw, and manage winners."
      />
      <DrawRegister isAdmin={isAdmin} currentMonth={currentMonth} />
    </div>
  );
}
