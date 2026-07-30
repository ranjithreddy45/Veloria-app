import type React from "react";
import { Gem, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-auth-mesh relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Layered ambient aura — soft violet/indigo/teal mesh */}
      <div aria-hidden className="bg-aura pointer-events-none absolute inset-0" />

      {/* Faint dotted grid overlay — barely visible, premium texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_center,oklch(0_0_0/0.06)_1px,transparent_1.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] dark:opacity-50 dark:[background-image:radial-gradient(circle_at_center,oklch(1_0_0/0.05)_1px,transparent_1.5px)]"
      />

      {/* Soft floating glow orbs for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.45_0.11_162/0.10),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,oklch(0.66_0.13_163/0.18),transparent_70%)]"
      />

      <div className="animate-rise-in relative z-10 flex w-full max-w-[400px] flex-col items-center px-6 py-12">
        {/* Brand lockup — full wordmark, falls back to ring-glow mark + text */}
        <div className="mb-9 flex flex-col items-center gap-3.5">
          <BrandLogo
            className="h-16 w-auto max-w-[260px] object-contain"
            fallback={
              <>
                <div className="logo-chip ring-glow-brand flex size-12 items-center justify-center rounded-[14px] text-primary-foreground">
                  <Gem className="size-[22px]" strokeWidth={2.2} />
                </div>
                <div className="text-center">
                  <h1 className="text-ink-gradient large-title text-[22px]">
                    Veloria Grand
                  </h1>
                  <p className="mt-1 text-[12.5px] tracking-wide text-muted-foreground">
                    Premium Event Venue Management
                  </p>
                </div>
              </>
            }
          />
        </div>

        {/* Card — elevated premium surface with hairline border + frosted blur */}
        <div className="shadow-premium w-full rounded-2xl border border-border/70 bg-card/85 p-8 backdrop-blur-xl">
          {children}
        </div>

        {/* Trust footer */}
        <div className="mt-7 flex flex-col items-center gap-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <ShieldCheck className="size-3.5 text-primary/70" />
            Enterprise-grade security &amp; encryption
          </p>
          <p className="text-center text-[11px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Veloria Grand. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
