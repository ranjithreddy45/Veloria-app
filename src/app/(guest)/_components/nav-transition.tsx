"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// v4 "native-feel navigation": push / pop / tab transitions.
//
// App Router navigations are same-document, so the CSS-only
// `@view-transition` rule never fires. Instead a link asks the provider to
// wrap `router.push` in `document.startViewTransition`, stamping the kind on
// <html> so guest.css can pick the right animation. The promise resolves when
// the pathname actually changes (or after a short cap, so a slow route can
// never freeze the screen). Browsers without the API, and users who prefer
// reduced motion, get a plain navigation.
// ============================================================

export type NavKind = "push" | "pop" | "tab";

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

const Ctx = React.createContext<{ go: (href: string, kind: NavKind) => void } | null>(null);

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const resolveRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => { resolveRef.current?.(); resolveRef.current = null; }, [pathname]);

  const go = React.useCallback((href: string, kind: NavKind) => {
    const doc = document as VTDocument;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A hidden document (background tab, PWA in the switcher) aborts the
    // transition with InvalidStateError — navigate plainly rather than throw.
    if (!doc.startViewTransition || reduce || document.visibilityState === "hidden") { router.push(href); return; }
    const cleanup = () => { delete document.documentElement.dataset.vgNav; };
    document.documentElement.dataset.vgNav = kind;
    try {
      const vt = doc.startViewTransition(() => new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        window.setTimeout(resolve, 600);
        router.push(href);
      }));
      vt.finished.then(cleanup, cleanup);
    } catch {
      cleanup();
      router.push(href);
    }
  }, [router]);

  const value = React.useMemo(() => ({ go }), [go]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const ctx = React.useContext(Ctx);
  const router = useRouter();
  return React.useCallback((href: string, kind: NavKind = "push") => (ctx ? ctx.go(href, kind) : router.push(href)), [ctx, router]);
}

/** Drop-in for <Link> inside the guest app. Plain-click navigations animate; modified clicks keep browser behaviour. */
export function NavLink({ href, kind = "push", children, className, onClick, ...rest }: React.ComponentProps<typeof Link> & { href: string; kind?: NavKind }) {
  const go = useNav();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go(href, kind);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Round 40px back control that pops. */
export function BackButton({ href, className, light }: { href: string; className?: string; light?: boolean }) {
  return (
    <NavLink href={href} kind="pop" aria-label="Back" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", light ? "bg-white/[.92] text-[#1d1d1f] backdrop-blur" : "border border-black/[.08] bg-white text-[#1d1d1f]", className)}>
      <ChevronLeft className="size-5" />
    </NavLink>
  );
}
