"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, CalendarCheck, MessageCircle } from "lucide-react";
import { COMPANY_WHATSAPP, HAS_PUBLIC_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Public storefront tabs only. The old "Bookings"/"Account"/"Sign in" tabs
// pointed at auth-gated staff/portal routes — a guest tapping them got ejected
// to /not-authorized. The 4th tab is now "Contact": a WhatsApp deep-link when a
// public channel is configured, otherwise the (public) enquiry form.
const contactHref =
  HAS_PUBLIC_CONTACT && COMPANY_WHATSAPP
    ? `https://wa.me/${COMPANY_WHATSAPP}`
    : "/app/book";

const TABS = [
  { href: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  {
    href: "/app/venues",
    label: "Venues",
    icon: Building2,
    match: (p: string) => p.startsWith("/app/venues"),
  },
  {
    href: "/app/book",
    label: "Book",
    icon: CalendarCheck,
    match: (p: string) => p.startsWith("/app/book"),
  },
  {
    href: contactHref,
    label: "Contact",
    icon: MessageCircle,
    match: () => false,
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)]"
      style={{ paddingBottom: "var(--sab)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          const external = tab.href.startsWith("http");
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active ? "bg-violet-100 text-violet-700" : "text-zinc-400"
                )}
              >
                <Icon
                  className="size-[21px]"
                  strokeWidth={active ? 2.5 : 2}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.15 : 0}
                />
              </span>
              <span
                className={cn(
                  "text-meta font-semibold",
                  active ? "text-violet-700" : "text-zinc-400"
                )}
              >
                {tab.label}
              </span>
            </>
          );
          const cls = "flex flex-1 flex-col items-center gap-1 py-2";

          return external ? (
            <a
              key={tab.href}
              href={tab.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cls}
            >
              {inner}
            </a>
          ) : (
            <Link key={tab.href} href={tab.href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
