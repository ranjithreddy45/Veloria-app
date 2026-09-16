import type { Metadata, Viewport } from "next";
import { TopNav } from "./_components/app-nav";
import { BottomNav } from "./_components/bottom-nav";
import { TransitionProvider } from "./_components/nav-transition";
import "./guest.css";

export const metadata: Metadata = {
  title: "Veloria Grand — Book Your Event",
  description:
    "Premium event venues in Bengaluru for weddings, receptions and celebrations. Browse halls, check availability, hold a date and plan every detail from your phone.",
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Veloria Grand" },
};

export const viewport: Viewport = {
  themeColor: "#6d1b52",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow pinch-zoom (accessibility — WCAG 1.4.4)
  viewportFit: "cover",
};

/**
 * Guest app shell (v3) — mobile-first, phone-width column, ivory canvas.
 * Public routes (discover + book) need no login; Plan/Account screens sit
 * behind the WhatsApp-OTP sign-in and read the same portal actions /portal
 * uses, so the two surfaces can never disagree.
 *
 * v5 — one responsive column. The shell is still exactly a phone column below
 * 640px; it widens to ~720px on a tablet and ~1120px on a laptop (.vg-col in
 * guest.css, which the sticky booking bar and the navigation read too).
 * Navigation follows the width: the fixed bottom tab bar below 1024px, the
 * same five destinations in a slim top bar at 1024px and up.
 */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vg-shell min-h-screen">
      <div className="vg-col relative flex min-h-screen flex-col bg-[#f3f0ec] shadow-sm sm:shadow-none">
        <TransitionProvider>
          {/* Laptop navigation, in the document before the content it leads to. */}
          <TopNav />
          {/* Bottom padding clears the tab bar PLUS the home-indicator inset;
              at >= 1024px there is no bottom bar to clear. */}
          <main className="flex-1 pb-[calc(6rem+var(--sab))] lg:pb-16">{children}</main>
          <BottomNav />
        </TransitionProvider>
      </div>
    </div>
  );
}
