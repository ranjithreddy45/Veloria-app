"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarCheck,
  Gavel,
  Wallet,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const vendorPortalLinks = [
  { href: "/vendor-portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor-portal/events", label: "Events", icon: CalendarCheck },
  { href: "/vendor-portal/bids", label: "Bids", icon: Gavel },
  { href: "/vendor-portal/payouts", label: "Payouts", icon: Wallet },
];

interface VendorPortalNavProps {
  userName: string;
}

export function VendorPortalNav({ userName }: VendorPortalNavProps) {
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
        <nav className="hidden items-center gap-1 md:flex">
          {vendorPortalLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === "/vendor-portal"
                ? pathname === "/vendor-portal"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-200",
                  isActive
                    ? "bg-teal-500/12 text-teal-700 dark:text-teal-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile hamburger button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <div className="ml-3 flex items-center gap-2 border-l pl-3">
          <span className="hidden text-[13px] text-muted-foreground sm:inline">
            {userName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Mobile dropdown navigation */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b bg-background shadow-card-hover md:hidden">
          <nav className="flex flex-col p-2">
            {vendorPortalLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/vendor-portal"
                  ? pathname === "/vendor-portal"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-teal-500/12 text-teal-700 dark:text-teal-300"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
