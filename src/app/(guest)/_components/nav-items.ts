// ============================================================
// The five roots of the customer app — one list, read by BOTH bars.
//
// A phone shows them in the fixed bottom tab bar; a laptop (>= 1024px), where
// a bar pinned to the bottom of the window reads as broken, shows the same
// five in a slim bar along the top. Same labels, same links, same order, same
// active rule — because there is only one list to read.
//
// Pure on purpose: no React, no icons, no server imports, so the contract the
// two bars share can be tested on its own.
// ============================================================

/** Which icon a tab wears. The bars map these to components; this file stays pure. */
export type GuestTabIcon = "home" | "halls" | "event" | "concierge" | "account";

export interface GuestTab {
  href: string;
  label: string;
  icon: GuestTabIcon;
}

export const GUEST_TABS: readonly GuestTab[] = [
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/venues", label: "Halls", icon: "halls" },
  { href: "/app/event", label: "My event", icon: "event" },
  { href: "/app/concierge", label: "Concierge", icon: "concierge" },
  { href: "/app/account", label: "Account", icon: "account" },
];

/**
 * True only on one of the five roots. Inner screens (a hall, a booking step,
 * the guest list…) carry a back button and their own action bar instead, so
 * neither bar shows there — on a phone or on a laptop.
 */
export function isRootTab(pathname: string): boolean {
  return GUEST_TABS.some((t) => t.href === pathname);
}

/** True for the tab the customer is on, so both bars mark the same one. */
export function isActiveTab(tab: GuestTab, pathname: string): boolean {
  return tab.href === pathname;
}

/**
 * The unread badge's text — "9+" past nine — or null when there is nothing
 * unread and no badge should be drawn at all. Never a "0".
 */
export function unreadBadgeText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const whole = Math.floor(count);
  return whole > 9 ? "9+" : String(whole);
}
