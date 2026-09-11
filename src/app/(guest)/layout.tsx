import type { Metadata, Viewport } from "next";
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
 */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vg-shell min-h-screen">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-[#f3f0ec] shadow-sm">
        {/* Bottom padding clears the tab bar PLUS the home-indicator inset. */}
        <TransitionProvider>
          <main className="flex-1 pb-[calc(6rem+var(--sab))]">{children}</main>
          <BottomNav />
        </TransitionProvider>
      </div>
    </div>
  );
}
