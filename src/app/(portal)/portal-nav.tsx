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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const portalLinks = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/bookings", label: "Bookings", icon: CalendarCheck },
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
        <nav className="hidden items-center gap-1 md:flex">
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
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                <Icon className="size-4" />
                {link.label}
                {badge !== null && (
                  <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
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
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  <Icon className="size-5" />
                  {link.label}
                  {badge !== null && (
                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
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
