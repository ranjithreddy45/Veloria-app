import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { Store } from "lucide-react";
import { VendorPortalNav } from "./vendor-portal-nav";
import { BrandLogo } from "@/components/layout/brand-logo";

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
    <div className="min-h-screen bg-muted/25">
      {/* Vendor Portal Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="relative mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          {/* Logo */}
          <Link
            href="/vendor-portal"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <BrandLogo
              className="h-9 w-auto max-w-[200px] object-contain object-left"
              fallback={
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <Store className="size-4" />
                  </div>
                  <span className="font-editorial text-[20px] leading-none tracking-[-0.01em] text-foreground">
                    Veloria Grand
                  </span>
                </div>
              }
            />
            <span className="hidden rounded-full bg-teal-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 sm:inline dark:text-teal-300">
              Partner
            </span>
          </Link>

          {/* Navigation + logout */}
          <VendorPortalNav userName={session.user.name || "Guest"} />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
        {children}
      </main>
    </div>
  );
}
