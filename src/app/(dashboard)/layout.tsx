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
        {/* pb: base padding PLUS the iOS home-indicator inset. Installed as a
            PWA there is no browser chrome, so the last row of any page (a Save
            button, the final table row) sat under the home indicator and could
            not be tapped. --sab is 0px in a browser, so desktop is unchanged.
            `overflow-auto` is kept (not switched to overflow-x-hidden) on
            purpose: main stays the scroll container, so a module that still
            overflows scrolls inside this box instead of making the whole
            document slide sideways — and nothing is silently clipped out of
            reach. */}
        <main className="flex-1 overflow-auto bg-background px-4 pt-4 pb-[calc(1rem+max(var(--sab),0px))] sm:px-6 sm:pt-6 sm:pb-[calc(1.5rem+max(var(--sab),0px))] lg:px-8 lg:pt-8 lg:pb-[calc(2rem+max(var(--sab),0px))]">
          <div className="mx-auto min-w-0 max-w-[1400px] animate-fade-in-up">
            {children}
          </div>
        </main>
      </SidebarInset>
      <AIChatWrapper />
    </SidebarProvider>
  );
}
