import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AIChatWrapper } from "@/components/ai/ai-chat-wrapper";

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
        <main className="flex-1 overflow-auto bg-muted/40 dark:bg-background bg-ambient px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1440px] animate-fade-in-up">
            {children}
          </div>
        </main>
      </SidebarInset>
      <AIChatWrapper />
    </SidebarProvider>
  );
}
