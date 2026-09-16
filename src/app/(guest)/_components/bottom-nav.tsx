"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-transition";
import { TabIcon, UnreadBadge, useConciergeUnread } from "./app-nav";
import { GUEST_TABS, isActiveTab, isRootTab } from "./nav-items";

// The phone (and tablet) tab bar. The destinations themselves live in
// nav-items.ts, because the laptop's top bar shows the same five.
//
// The bar shows ONLY on the five roots — inner screens (hall detail, booking
// steps, guest list…) use a back button and their own sticky action bar
// instead, exactly as the prototype does. At 1024px and up it is hidden
// altogether and TopNav takes over: a bar pinned to the bottom of a laptop
// window reads as broken.

export function BottomNav() {
  const pathname = usePathname();
  const isRoot = isRootTab(pathname);
  const unread = useConciergeUnread(isRoot);

  if (!isRoot) return null;

  return (
    <nav
      className="vg-glass-white fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingBottom: "calc(var(--sab) + 6px)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2 pt-2">
        {GUEST_TABS.map((tab) => {
          const active = isActiveTab(tab, pathname);
          return (
            <NavLink
              key={tab.href}
              href={tab.href}
              kind="tab"
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center gap-1 py-1 transition-colors",
                active ? "text-[#6d1b52]" : "text-[#8e8e93]"
              )}
            >
              <span className="relative">
                <TabIcon icon={tab.icon} active={active} />
                {tab.icon === "concierge" && <UnreadBadge count={unread} className="absolute -right-2 -top-1" />}
              </span>
              <span className="text-[10.5px] font-semibold">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
