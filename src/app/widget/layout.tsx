import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Book Your Event | ${APP_NAME}`,
  description: `Submit an inquiry to book your event at ${APP_NAME}. Our team will get back to you within 24 hours.`,
};

// ============================================================
// Widget Layout — Standalone (No Dashboard Shell)
// ============================================================

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {APP_NAME}
          </h1>
          <p className="text-sm text-muted-foreground">
            Premium Event Venue Management
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t bg-card px-6 py-4">
        <div className="mx-auto max-w-2xl text-center text-sm text-muted-foreground/60">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
