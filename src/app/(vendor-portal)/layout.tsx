import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { Store } from "lucide-react";
import { VendorPortalNav } from "./vendor-portal-nav";

export default async function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Check vendor-portal:access permission
  if (!hasPermission(session.user.role as string, "vendor-portal:access")) {
    redirect("/not-authorized");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Vendor Portal Header */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/vendor-portal"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-white dark:bg-violet-500">
              <Store className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
                Veloria Grand
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                Vendor Portal
              </span>
            </div>
          </Link>

          {/* Navigation + logout */}
          <VendorPortalNav userName={session.user.name || "Guest"} />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
