import Link from "next/link";
import { Building2, Eye } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { VenuePortalNav } from "../venue-portal-nav";

// ============================================================
// Venue owner portal — the chrome around every page.
// ------------------------------------------------------------
// Deliberately not the staff shell: no sidebar, no header search, no command
// palette, no chat — nothing that could lead to a customer record. Plain
// props only; the layout does the session and scope checks.
// ============================================================

export function PortalShell({
  preview,
  userName,
  children,
}: {
  /** An admin previewing the portal rather than a venue owner. */
  preview: boolean;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/25">
      {/* pad-safe-top so the sticky bar clears the status bar when installed. */}
      <header className="pad-safe-top sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="relative mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          {/* The pill and (in the nav) the user's name wait for lg: at sm/md
              they squeezed the lockup onto two lines. */}
          <Link href="/venue-portal" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80">
            <BrandLogo
              className="h-9 w-auto max-w-[160px] object-contain object-left sm:max-w-[200px]"
              fallback={
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <Building2 className="size-4" />
                  </div>
                  <span className="whitespace-nowrap font-editorial text-title leading-none tracking-[-0.01em] text-foreground">
                    Veloria Grand
                  </span>
                </div>
              }
            />
            {preview ? (
              <span className="hidden whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-1 text-meta font-semibold uppercase tracking-[0.16em] text-amber-700 lg:inline dark:text-amber-300">
                Owner preview
              </span>
            ) : (
              <span className="hidden whitespace-nowrap rounded-full bg-emerald-500/12 px-2.5 py-1 text-meta font-semibold uppercase tracking-[0.16em] text-emerald-700 lg:inline dark:text-emerald-300">
                Venue owner
              </span>
            )}
          </Link>

          <VenuePortalNav userName={userName} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:py-14">
        {preview && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Admin preview — this is exactly what venue owners see (for the selected venue).</p>
          </div>
        )}
        {children}
      </main>

      {/* Bottom inset added to the padding so the line clears the home
          indicator when the portal runs as an installed app. */}
      <footer className="mx-auto max-w-6xl px-4 pb-[calc(2.5rem+var(--sab))] sm:px-8">
        <p className="border-t pt-6 text-center text-detail text-muted-foreground">
          Counts only — customer details and amounts are not shown here.
        </p>
      </footer>
    </div>
  );
}
