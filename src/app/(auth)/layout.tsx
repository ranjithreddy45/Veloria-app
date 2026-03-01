import type React from "react";
import { Gem } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-[oklch(0.12_0.025_277)] dark:via-[oklch(0.13_0.015_277)] dark:to-[oklch(0.12_0.02_300)]">
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-indigo-400/20 blur-[100px] dark:bg-indigo-600/10" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-violet-400/20 blur-[100px] dark:bg-violet-600/10" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-64 -translate-x-1/2 rounded-full bg-indigo-300/10 blur-[80px] dark:bg-indigo-500/5" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/15">
            <Gem className="size-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Veloria Grand
            </h1>
            <p className="text-sm text-muted-foreground">
              Premium Event Venue Management
            </p>
          </div>
        </div>

        {/* Card container with glassmorphism */}
        <div className="w-full rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-500/5 backdrop-blur-xl dark:border-[oklch(1_0.01_277_/_12%)] dark:bg-[oklch(0.165_0.02_277_/_80%)] dark:shadow-[0_0_0_1px_oklch(1_0.01_277_/_8%),0_0_20px_oklch(0.55_0.24_277_/_6%),0_8px_30px_oklch(0_0_0_/_30%)]">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Veloria Grand. All rights reserved.
        </p>
      </div>
    </div>
  );
}
