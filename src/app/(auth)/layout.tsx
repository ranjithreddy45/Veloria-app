import type React from "react";
import { Gem } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-auth-mesh relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Faint dotted grid overlay — barely visible, premium texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_center,oklch(0_0_0/0.06)_1px,transparent_1.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] dark:opacity-50 dark:[background-image:radial-gradient(circle_at_center,oklch(1_0_0/0.05)_1px,transparent_1.5px)]"
      />

      <div className="relative z-10 flex w-full max-w-[380px] flex-col items-center px-6 py-12">
        {/* Logo — full wordmark, falls back to mark + text if /logo.png absent */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo
            className="h-16 w-auto max-w-[260px] object-contain"
            fallback={
              <>
                <div className="logo-chip flex size-10 items-center justify-center rounded-[10px] text-primary-foreground">
                  <Gem className="size-[18px]" strokeWidth={2.4} />
                </div>
                <div className="text-center">
                  <h1 className="text-[17px] font-semibold tracking-[-0.022em] text-foreground">
                    Veloria Grand
                  </h1>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Premium Event Venue Management
                  </p>
                </div>
              </>
            }
          />
        </div>

        {/* Card — subtle elevated surface with hairline border */}
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-7 shadow-[0_1px_2px_oklch(0_0_0/4%),0_4px_24px_oklch(0_0_0/3%)] backdrop-blur-sm">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          &copy; {new Date().getFullYear()} Veloria Grand. All rights reserved.
        </p>
      </div>
    </div>
  );
}
