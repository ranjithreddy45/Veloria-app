"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarDays, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// Venue owner portal — header navigation (two links + sign out).
// ============================================================

const links = [
  { href: "/venue-portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venue-portal/calendar", label: "Calendar", icon: CalendarDays },
];

// Literal class strings per state, never merged through cn(): tailwind-merge
// reads text-body / text-copy as a text colour and drops it when the
// active/idle colour follows.
const BAR_LINK = "flex items-center gap-2 rounded-full px-3.5 py-2 text-body font-medium transition-colors duration-200";
const BAR_LINK_ACTIVE = `${BAR_LINK} bg-emerald-500/12 text-emerald-700 dark:text-emerald-300`;
const BAR_LINK_IDLE = `${BAR_LINK} text-muted-foreground hover:bg-muted hover:text-foreground`;
const MENU_LINK = "flex items-center gap-3 rounded-xl px-4 py-3 text-copy font-medium transition-colors";
const MENU_LINK_ACTIVE = `${MENU_LINK} bg-emerald-500/12 text-emerald-700 dark:text-emerald-300`;
const MENU_LINK_IDLE = `${MENU_LINK} text-muted-foreground hover:bg-muted hover:text-foreground`;

function isActive(pathname: string, href: string) {
  return href === "/venue-portal" ? pathname === "/venue-portal" : pathname.startsWith(href);
}

export function VenuePortalNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close the mobile menu on route change.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Tap anywhere outside to dismiss. A document listener rather than a
  // full-screen scrim because the header carries `backdrop-blur-md`, and
  // backdrop-filter makes an element the containing block for its
  // fixed-position descendants — a `fixed inset-0` overlay rendered in here
  // would only ever cover the header strip. (Same approach as portal-nav.)
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
      <div ref={barRef} className="flex shrink-0 items-center gap-1">
        <nav className="hidden items-center gap-1 md:flex" aria-label="Venue portal">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={active ? BAR_LINK_ACTIVE : BAR_LINK_IDLE}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <div className="ml-2 flex items-center gap-2 border-l pl-2 sm:ml-3 sm:pl-3">
          <span className="hidden max-w-[160px] truncate text-body text-muted-foreground lg:inline">{userName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 right-0 top-full z-50 border-b bg-background pb-[var(--sab)] shadow-card-hover md:hidden"
        >
          <nav className="flex flex-col p-2" aria-label="Venue portal">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? MENU_LINK_ACTIVE : MENU_LINK_IDLE}
                >
                  <Icon className="size-5" />
                  {link.label}
                </Link>
              );
            })}
            {/* The name is hidden in the bar below lg; on a phone this is where it fits. */}
            <p className="mt-1 border-t px-4 pb-1 pt-3 text-detail text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{userName}</span>
            </p>
          </nav>
        </div>
      )}
    </>
  );
}
