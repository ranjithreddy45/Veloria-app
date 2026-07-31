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
      {/* pad-safe-top: installed as a PWA there is no browser chrome, so a
          sticky top-0 header would sit under the iOS status bar / notch. */}
      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 pad-safe-top sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
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
      {/* px-4 on phones (was px-5): 8px more content width at 375px, which is
          the difference between a truncated invoice number and a readable one. */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>

      {/* Bottom inset added to the padding rather than via pad-safe-bottom so
          the 2.5rem breathing room survives on devices with no home indicator. */}
      <footer className="mx-auto mt-8 max-w-6xl px-4 pb-[calc(2.5rem+var(--sab))] sm:px-8">
        <div className="text-muted-foreground/70 border-t pt-6 text-center text-xs">
          <span className="font-editorial text-[13px]">Veloria Grand</span>
          <span className="mx-2">&middot;</span>
          Every detail, considered.
        </div>
      </footer>
    </div>
  );
}
