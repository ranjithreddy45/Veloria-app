import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink, BackButton } from "./nav-transition";

// ============================================================
// Guest-app primitives — the v3 design's recurring objects, composed once
// so every screen shares the same edges, radii and type. Server-safe:
// nothing here uses hooks.
// ============================================================

export function Screen({ children, className, flush }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cn("vg-rise flex flex-col gap-[18px]", flush ? "" : "px-5 pt-[calc(var(--sat)+0.5rem)]", className)}>
      {children}
    </div>
  );
}

/** Round 40px back button + title, with an optional right-hand action. */
export function ScreenHeader({ title, backHref, action, sub }: { title: string; backHref?: string; action?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      {backHref && <BackButton href={backHref} />}
      <div className="min-w-0 flex-1">
        <div className="text-copy font-semibold">{title}</div>
        {sub && <div className="text-meta text-[#6e6e73]">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/** Large editorial title (Fraunces) used at the top of root screens. */
export function Title({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("font-editorial text-[31px] font-semibold leading-[1.1] tracking-[-.018em] text-[#1d1d1f]", className)}>{children}</h1>;
}

export function Card({ children, className, as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" }) {
  return <Tag className={cn("vg-card rounded-2xl", className)}>{children}</Tag>;
}

export function SectionTitle({ title, action, sub }: { title: string; action?: { label: string; href: string }; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="text-copy font-semibold">{title}</div>
      {action && <Link href={action.href} className="text-detail font-semibold text-[#6d1b52]">{action.label}</Link>}
      {sub && !action && <div className="text-detail text-[#6e6e73]">{sub}</div>}
    </div>
  );
}

/** Gradient primary — renders as a link when href is given. */
export function PrimaryButton({ children, href, className, type = "button", disabled, onClick, form }: {
  children: React.ReactNode; href?: string; className?: string; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void; form?: string;
}) {
  const cls = cn("vg-primary vg-press inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-copy font-semibold", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} disabled={disabled} onClick={onClick} form={form} className={cls}>{children}</button>;
}

export function GhostButton({ children, href, className, onClick, type = "button" }: { children: React.ReactNode; href?: string; className?: string; onClick?: () => void; type?: "button" | "submit" }) {
  const cls = cn("inline-flex items-center justify-center rounded-2xl border border-black/[.08] bg-white px-5 py-3.5 text-body font-semibold text-[#1d1d1f]", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} onClick={onClick} className={cls}>{children}</button>;
}

/** Selectable pill — plum when active. */
export function Chip({ children, active, href, onClick, className }: { children: React.ReactNode; active?: boolean; href?: string; onClick?: () => void; className?: string }) {
  const cls = cn(
    "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 py-2 text-detail font-semibold transition-colors",
    active ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.08] bg-white text-[#1d1d1f]",
    className
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export type Tone = "plum" | "gold" | "green" | "amber" | "grey" | "ink";
const TONES: Record<Tone, string> = {
  plum: "bg-[#f7eef2] text-[#6d1b52]",
  gold: "bg-[#faf3e1] text-[#b88513]",
  green: "bg-[#e6f6ea] text-[#2a9d4a]",
  amber: "bg-[#fdf3e1] text-[#c77700]",
  grey: "bg-[#f0f0f2] text-[#6e6e73]",
  ink: "bg-[#e9e9ec] text-[#1d1d1f]",
};

export function Pill({ children, tone = "grey", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-meta font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Avatar({ text, tone = "plum", size = 36, className }: { text: string; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full text-detail font-semibold", TONES[tone], className)} style={{ width: size, height: size }}>
      {text}
    </span>
  );
}

/** Icon tile with the soft plum gradient from the design. */
export function IconTile({ children, tone = "plum", size = 32, className }: { children: React.ReactNode; tone?: Tone; size?: number; className?: string }) {
  const bg = tone === "gold" ? "bg-[#faf3e1] text-[#b88513]" : tone === "green" ? "bg-[#e6f6ea] text-[#2a9d4a]" : tone === "amber" ? "bg-[#fdf3e1] text-[#c77700]" : tone === "ink" ? "bg-[#e9e9ec] text-[#1d1d1f]" : "bg-gradient-to-br from-[#fbf1f6] to-[#efdbe7] text-[#6d1b52] shadow-[inset_0_0_0_1px_rgba(109,27,82,.08)]";
  return <span className={cn("flex shrink-0 items-center justify-center rounded-[10px]", bg, className)} style={{ width: size, height: size }}>{children}</span>;
}

export function ProgressBar({ pct, className, track = "bg-[#e9e9ec]", fill = "bg-[#6d1b52]" }: { pct: number; className?: string; track?: string; fill?: string }) {
  const w = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full", track, className)} role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${w}%` }} />
    </div>
  );
}

/** List row with trailing chevron — the Account / Documents pattern. */
export function Row({ children, href, detail, className }: { children: React.ReactNode; href?: string; detail?: React.ReactNode; className?: string }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1 text-copy">{children}</div>
      {detail && <div className="text-detail text-[#6e6e73]">{detail}</div>}
      <ChevronRight className="size-4 text-[#c7c7cc]" />
    </>
  );
  const cls = cn("flex min-h-[52px] w-full items-center gap-3 px-4 py-3.5 text-left text-[#1d1d1f]", className);
  return href ? <NavLink href={href} kind="push" className={cls}>{inner}</NavLink> : <div className={cls}>{inner}</div>;
}

/** Honest empty state — says what is missing, never fills the gap with fiction. */
export function EmptyNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-5 text-center text-body text-[#6e6e73]", className)}>{children}</p>;
}

export function KeyValue({ rows, total }: { rows: { k: string; v: React.ReactNode }[]; total?: { k: string; v: React.ReactNode } }) {
  return (
    <Card className="vg-divide overflow-hidden">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-4 px-4 py-3 text-body">
          <span className="text-[#6e6e73]">{r.k}</span>
          <span className="text-right font-semibold">{r.v}</span>
        </div>
      ))}
      {total && (
        <div className="flex justify-between gap-4 px-4 py-3.5 text-copy">
          <span className="font-semibold">{total.k}</span>
          <span className="numeric font-semibold text-[#6d1b52]">{total.v}</span>
        </div>
      )}
    </Card>
  );
}

/**
 * A photo as a CSS background (v4: "dynamic photos render as background
 * images"). A missing or slow file shows the gradient beneath instead of a
 * broken-image glyph, and base64 data URLs — how uploads are stored here —
 * work without an image optimiser.
 */
export function Photo({ src, alt, className, children }: { src?: string | null; alt: string; className?: string; children?: React.ReactNode }) {
  const safe = src ? src.replace(/["\\]/g, "\\$&") : null;
  return (
    <div role="img" aria-label={alt} className={cn("relative overflow-hidden bg-gradient-to-br from-[#7a2160] via-[#6d1b52] to-[#4d1239]", className)}>
      {safe && <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${safe}")` }} />}
      {children}
    </div>
  );
}
