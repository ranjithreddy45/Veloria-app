import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AIChatWrapper } from "@/components/ai/ai-chat-wrapper";
import { ActiveAlertsPopup } from "@/components/layout/active-alerts-popup";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Redirect clients to portal
  if (session.user.role === "CLIENT") {
    redirect("/portal");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-auto bg-background px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto min-w-0 max-w-[1400px] animate-fade-in-up">
            {children}
          </div>
        </main>
      </SidebarInset>
      <AIChatWrapper />
      <ActiveAlertsPopup />
    </SidebarProvider>
  );
}
