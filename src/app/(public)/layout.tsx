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
    <div className="bg-background flex min-h-screen flex-col">
      {/* Minimal Branded Header */}
      {/* pad-safe-top: these tokenized links are opened from WhatsApp and, once
          the app is installed, run full-screen with no browser chrome. */}
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 pad-safe-top border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-center px-5">
          <div className="flex items-center gap-2.5">
            <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
              <Gem className="size-3.5" />
            </div>
            <span className="font-editorial text-foreground text-lede font-semibold tracking-tight">
              Veloria Grand
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      {/* py-14 on a 812px-tall phone spent 112px of the first screen on empty
          space before the quote/price even started. Tighter on mobile only. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-5 sm:py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 pb-[calc(2rem+var(--sab))] text-center">
        <p className="font-editorial text-muted-foreground text-body">
          Veloria Grand
        </p>
        <p className="text-muted-foreground/60 mt-1 text-meta uppercase tracking-[0.16em]">
          Every detail, considered
        </p>
      </footer>
    </div>
  );
}
