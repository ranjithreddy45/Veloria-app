"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  CalendarCheck,
  FileText,
  CreditCard,
  FileSignature,
  Image as ImageIcon,
  Gift,
  FolderOpen,
  Users,
  Smartphone,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const portalLinks = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/portal/guests", label: "Guests", icon: Users },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
  { href: "/portal/payments", label: "Payments", icon: CreditCard },
  { href: "/portal/contracts", label: "Contracts", icon: FileSignature, badgeKey: "contracts" as const },
  { href: "/portal/documents", label: "Documents", icon: FolderOpen },
  { href: "/portal/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/portal/loyalty", label: "Rewards", icon: Gift },
];

interface PortalNavProps {
  userName: string;
  /** Count of contracts awaiting the client's signature (H2 badge). */
  contractsAwaiting?: number;
}

export function PortalNav({ userName, contractsAwaiting = 0 }: PortalNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Tap anywhere outside to dismiss. Done with a document listener rather than
  // a full-screen scrim element because the portal header carries
  // `backdrop-blur-xl`, and backdrop-filter makes an element the containing
  // block for its fixed-position descendants — a `fixed inset-0` overlay
  // rendered in here would only ever cover the header strip.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (barRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMobileOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mobileOpen]);

  return (
    <>
      <div ref={barRef} className="flex items-center gap-1">
        {/* Desktop navigation */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {portalLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(link.href);

            const badge =
              link.badgeKey === "contracts" && contractsAwaiting > 0
                ? contractsAwaiting
                : null;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                  isActive
                    ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
                {link.label}
                {badge !== null && (
                  <span className="bg-primary text-primary-foreground numeric ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile hamburger button. Carries the unread-contracts count as a dot
            so a signature request isn't invisible behind a closed menu. */}
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          {!mobileOpen && contractsAwaiting > 0 && (
            <span className="bg-primary absolute right-1.5 top-1.5 size-2 rounded-full" />
          )}
        </Button>

        <div className="ml-2 flex items-center gap-1 border-l pl-2 sm:ml-3 sm:gap-2 sm:pl-3">
          {/* Install the app — the /get-app page detects the platform and shows
              either a real install button or the iOS Add-to-Home-Screen steps. */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground hidden gap-1.5 md:inline-flex"
          >
            <Link href="/get-app">
              <Smartphone className="size-4" />
              <span className="hidden lg:inline">Get the app</span>
            </Link>
          </Button>
          <span className="text-muted-foreground hidden text-[13px] sm:inline">
            {userName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-2 hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Mobile dropdown navigation.
          - max-h + scroll: nine links plus the account rows are taller than
            the viewport in landscape or on a short screen, and an unscrollable
            menu strands the last items off-screen with no way to reach them.
          - Bottom safe-area padding so the last link isn't under the home
            indicator when the portal runs as an installed PWA. */}
      {mobileOpen && (
        <div
          ref={menuRef}
          className="bg-background shadow-card-hover absolute left-0 right-0 top-full z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto border-b pb-[var(--sab)] lg:hidden"
        >
          <nav className="flex flex-col p-2">
            {portalLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(link.href);

              const badge =
                link.badgeKey === "contracts" && contractsAwaiting > 0
                  ? contractsAwaiting
                  : null;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-foreground/[0.06] text-foreground"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  )}
                >
                  <Icon className="size-[18px]" />
                  {link.label}
                  {badge !== null && (
                    <span className="bg-primary text-primary-foreground numeric ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Account rows. "Get the app" was `hidden md:inline-flex` and the
                user's name `hidden sm:inline` in the header — which meant the
                phone users this PWA is aimed at had no route to /get-app at
                all. Surfacing both here is the only place they fit. */}
            <div className="mt-1 space-y-1 border-t pt-2">
              <Link
                href="/get-app"
                className="text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
              >
                <Smartphone className="size-[18px]" />
                Get the app
              </Link>
              <p className="text-muted-foreground/70 px-4 py-2 text-xs">
                Signed in as{" "}
                <span className="text-foreground font-medium">{userName}</span>
              </p>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
