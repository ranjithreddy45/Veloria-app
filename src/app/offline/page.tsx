import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "You're offline — Veloria Grand",
  robots: { index: false, follow: false },
};

// Cached by the service worker and shown only when a page navigation fails
// because the device is genuinely offline. Deliberately static: no data, no
// session — it must render from cache with zero network.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="bg-card shadow-card w-full max-w-sm rounded-2xl border p-8 text-center">
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-2xl">
          <WifiOff className="text-muted-foreground size-6" />
        </div>
        <h1 className="text-foreground mt-5 text-[26px]">You&apos;re offline</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Veloria Grand needs a connection for live bookings and payments. Check your
          network — the app will pick up right where you left off.
        </p>
      </div>
    </div>
  );
}
