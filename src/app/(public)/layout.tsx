import { Gem } from "lucide-react";

// ============================================================
// Public Layout — Minimal, No Auth, No Dashboard Sidebar
// ============================================================

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Minimal Branded Header */}
      <header className="border-b border-zinc-200/60 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-center px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Gem className="size-3.5" />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Veloria Grand
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-12">{children}</main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Powered by Veloria Grand
      </footer>
    </div>
  );
}
