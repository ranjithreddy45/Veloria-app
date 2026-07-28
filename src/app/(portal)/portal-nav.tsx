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

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="flex items-center gap-1">
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

        {/* Mobile hamburger button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <div className="ml-3 flex items-center gap-2 border-l pl-3">
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

      {/* Mobile dropdown navigation */}
      {mobileOpen && (
        <div className="bg-background shadow-card-hover absolute left-0 right-0 top-full z-50 border-b lg:hidden">
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
          </nav>
        </div>
      )}
    </>
  );
}
