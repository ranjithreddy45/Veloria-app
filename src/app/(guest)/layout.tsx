import type { Metadata, Viewport } from "next";
import { BottomNav } from "./_components/bottom-nav";

export const metadata: Metadata = {
  title: "Veloria Grand — Book Your Event",
  description:
    "Premium event venues in Bangalore for weddings, receptions, and celebrations. Browse halls, check availability, and book in minutes.",
  manifest: "/app.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Veloria Grand",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow pinch-zoom (accessibility — WCAG 1.4.4)
  viewportFit: "cover",
};

/**
 * Guest app shell — mobile-first, public (no auth).
 * Constrained to a phone-width column so it feels like a native app
 * even on desktop, with a fixed bottom tab bar.
 */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-sm">
        {/* Content — bottom padding clears the tab bar. The bar is ~66px tall
            PLUS the home-indicator inset it pads itself with, so a flat pb-24
            (96px) left the last card clipped on an iPhone with a home bar. */}
        <main className="flex-1 pb-[calc(6rem+var(--sab))]">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
