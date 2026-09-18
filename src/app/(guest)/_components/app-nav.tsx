"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Home, Building2, CalendarDays, MessageCircle, UserRound } from "lucide-react";
import { getConciergeUnreadCount } from "@/actions/guest-concierge.actions";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-transition";
import { GUEST_TABS, isActiveTab, isRootTab, unreadBadgeText, type GuestTabIcon } from "./nav-items";

// ============================================================
// The laptop's navigation, and the pieces both bars share.
//
// Below 1024px the app keeps its fixed bottom tab bar (bottom-nav.tsx) — that
// is the phone and tablet experience and it does not change. At 1024px and up
// a bar stuck to the bottom of a laptop window reads as broken, so the SAME
// five destinations move into a slim bar along the top and the bottom bar is
// hidden. Both bars read GUEST_TABS, so the labels, links, order and active
// tab can never disagree; exactly one of the two is ever in the accessibility
// tree, because the other is display:none.
// ============================================================

const ICONS: Record<GuestTabIcon, typeof Home> = {
  home: Home,
  halls: Building2,
  event: CalendarDays,
  concierge: MessageCircle,
  account: UserRound,
};

export function TabIcon({ icon, active, className }: { icon: GuestTabIcon; active: boolean; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={cn("size-6", className)} strokeWidth={1.8} fill={active ? "rgba(109,27,82,.18)" : "none"} aria-hidden />;
}

/**
 * Team replies the customer has not opened yet, refreshed whenever a root
 * screen opens. `enabled` is false on inner screens, where no bar is drawn.
 */
export function useConciergeUnread(enabled: boolean): number {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getConciergeUnreadCount()
      .then((n) => {
        if (alive) setUnread(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname, enabled]);

  return unread;
}

/** The red count on the Concierge tab. Absent, not zero, when nothing is unread. */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  const text = unreadBadgeText(count);
  if (!text) return null;
  return (
    <span className={cn("min-w-4 rounded-full bg-[#d70015] px-1 text-center text-[10px] font-bold leading-4 text-white", className)}>
      {text}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/**
 * The laptop bar. Hidden below 1024px, where the bottom tab bar is the
 * navigation; shown on exactly the screens the bottom bar shows on, so the
 * app's rule — roots get a bar, inner screens get a back button — is one rule
 * at every width.
 */
export function TopNav() {
  const pathname = usePathname();
  const isRoot = isRootTab(pathname);
  const unread = useConciergeUnread(isRoot);

  if (!isRoot) return null;

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 hidden border-b border-black/[.07] bg-white/[.86] backdrop-blur-xl backdrop-saturate-150 lg:block"
    >
      <ul className="vg-gutter flex h-14 list-none items-stretch gap-1">
        {GUEST_TABS.map((tab) => {
          const active = isActiveTab(tab, pathname);
          return (
            <li key={tab.href} className="relative flex">
              <NavLink
                href={tab.href}
                kind="tab"
                aria-current={active ? "page" : undefined}
                className={cn(
                  // The active tab is marked three ways — colour, a weight change
                  // and the gold rule underneath — so it never rests on colour alone.
                  "flex min-h-11 items-center gap-2 self-center rounded-full px-3 py-2 text-detail transition-colors",
                  // #636368 is the guest app's accessible secondary ink (GUEST_MUTED_INK).
                  active ? "font-semibold text-[#6d1b52]" : "font-medium text-[#636368] hover:text-[#1d1d1f]"
                )}
              >
                <TabIcon icon={tab.icon} active={active} className="size-[18px]" />
                <span>{tab.label}</span>
                {tab.icon === "concierge" && <UnreadBadge count={unread} />}
              </NavLink>
              {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-[#b88513]" />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
