import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

// ============================================================
// 404 — Not Found (App Root)
// ============================================================

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 size-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
        <div className="absolute -bottom-40 left-0 size-[400px] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <div className="relative flex max-w-md flex-col items-center gap-8 text-center">
        {/* Icon */}
        <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/50 dark:to-violet-950/50">
          <FileQuestion className="size-10 text-indigo-600 dark:text-indigo-400" />
        </div>

        {/* Text */}
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            404 Error
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Page not found
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have been
            moved. Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            className="gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
            asChild
          >
            <Link href="/dashboard">
              <Home className="size-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>

        {/* Branding */}
        <p className="text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </div>
  );
}
