import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/../auth";
import { Gem } from "lucide-react";
import { PortalNav } from "./portal-nav";
import { BrandLogo } from "@/components/layout/brand-logo";
import { getPortalContracts } from "@/actions/contract.actions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // H2: contracts awaiting the client's signature drive the nav badge.
  const contracts = await getPortalContracts(session.user.id);
  const contractsAwaiting = contracts.filter(
    (c) => c.status === "SENT" || c.status === "VIEWED"
  ).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Portal Header */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/portal"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <BrandLogo
              className="h-9 w-auto max-w-[200px] object-contain object-left"
              fallback={
                <>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-900">
                    <Gem className="size-4" />
                  </div>
                  <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Veloria Grand
                  </span>
                </>
              }
            />
          </Link>

          {/* Navigation + logout */}
          <PortalNav
            userName={session.user.name || "Guest"}
            contractsAwaiting={contractsAwaiting}
          />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
