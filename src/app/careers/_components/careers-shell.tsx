import type React from "react";
import Link from "next/link";
import { Gem } from "lucide-react";

// Standalone premium shell for the PUBLIC careers site.
// No app sidebar — this renders top-level, outside the dashboard.
export function CareersShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-auth-mesh relative min-h-screen overflow-hidden">
      {/* Faint dotted grid overlay — premium texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_center,oklch(0_0_0/0.06)_1px,transparent_1.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_70%)] dark:opacity-50 dark:[background-image:radial-gradient(circle_at_center,oklch(1_0_0/0.05)_1px,transparent_1.5px)]"
      />

      {/* Brand header */}
      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/careers" className="flex items-center gap-3">
            <span className="logo-chip flex size-9 items-center justify-center rounded-[10px] text-primary-foreground">
              <Gem className="size-[17px]" strokeWidth={2.4} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-copy font-semibold tracking-[-0.022em] text-foreground">
                Veloria Grand
              </span>
              <span className="text-meta text-muted-foreground">Careers</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 mx-auto max-w-5xl px-6 py-10">
        <p className="text-center text-meta text-muted-foreground/70">
          &copy; {new Date().getFullYear()} Veloria Grand. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
