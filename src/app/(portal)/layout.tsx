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
    <div className="bg-background min-h-screen">
      {/* Portal Header */}
      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          {/* Logo */}
          <Link
            href="/portal"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <BrandLogo
              className="h-9 w-auto max-w-[200px] object-contain object-left"
              fallback={
                <>
                  <div className="bg-foreground text-background flex size-8 items-center justify-center rounded-xl">
                    <Gem className="size-4" />
                  </div>
                  <span className="font-editorial text-foreground text-[19px] font-semibold tracking-tight">
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
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        {children}
      </main>

      <footer className="mx-auto mt-8 max-w-6xl px-5 pb-10 sm:px-8">
        <div className="text-muted-foreground/70 border-t pt-6 text-center text-xs">
          <span className="font-editorial text-[13px]">Veloria Grand</span>
          <span className="mx-2">&middot;</span>
          Every detail, considered.
        </div>
      </footer>
    </div>
  );
}
