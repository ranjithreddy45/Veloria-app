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
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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

        <div className="ml-3 flex items-center gap-2 border-l pl-3 dark:border-zinc-700">
          <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
            {userName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-zinc-500 hover:text-red-600"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Mobile dropdown navigation */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b bg-white shadow-lg md:hidden dark:border-zinc-700 dark:bg-zinc-900">
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
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
