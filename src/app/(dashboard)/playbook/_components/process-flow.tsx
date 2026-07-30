import {
  Handshake,
  Briefcase,
  Target,
  UtensilsCrossed,
  IndianRupee,
  Users,
  Zap,
  ShieldCheck,
  ArrowRight,
  CircleUserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VALUE_CHAIN, PROCESSES, type Process, type ProcessStep } from "@/lib/playbook/process-data";

const ICONS: Record<string, LucideIcon> = {
  Handshake,
  Briefcase,
  Target,
  UtensilsCrossed,
  IndianRupee,
  Users,
};

type Accent = Process["accent"];

const ACCENT: Record<Accent, { soft: string; text: string; ring: string; dot: string; bar: string; chipBg: string }> = {
  gold: { soft: "bg-gold/10", text: "text-gold", ring: "ring-gold/30", dot: "bg-gold", bar: "bg-gold", chipBg: "bg-gold/15 text-gold" },
  emerald: { soft: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-900", dot: "bg-emerald-500", bar: "bg-emerald-500", chipBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  amber: { soft: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900", dot: "bg-amber-500", bar: "bg-amber-500", chipBg: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  blue: { soft: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", ring: "ring-blue-200 dark:ring-blue-900", dot: "bg-blue-500", bar: "bg-blue-500", chipBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  rose: { soft: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-200 dark:ring-rose-900", dot: "bg-rose-500", bar: "bg-rose-500", chipBg: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  cyan: { soft: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", ring: "ring-cyan-200 dark:ring-cyan-900", dot: "bg-cyan-500", bar: "bg-cyan-500", chipBg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" },
};

// ---- Value chain band -------------------------------------------------
export function ValueChain() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-premium">
      <h2 className="text-sm font-semibold tracking-tight">How the company works, end to end</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Six processes, connected. We acquire venues, ready them, sell events, deliver them, and record the money — and our people run all of it.
      </p>
      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-1.5">
        {VALUE_CHAIN.map((v, i) => {
          const a = ACCENT[v.accent];
          const Icon = ICONS[v.icon] ?? CircleUserRound;
          return (
            <div key={v.name} className="flex items-center gap-1.5 lg:flex-1">
              <div className={cn("flex-1 rounded-xl p-3 ring-1", a.soft, a.ring)}>
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-7 items-center justify-center rounded-lg", a.chipBg)}>
                    <Icon className="size-4" />
                  </span>
                  <span className={cn("text-[13px] font-semibold", a.text)}>{v.name}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{v.sub}</p>
              </div>
              {i < VALUE_CHAIN.length - 1 && (
                <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground/50 lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- One step card ----------------------------------------------------
function Step({ step, index, accent, isLast }: { step: ProcessStep; index: number; accent: Accent; isLast: boolean }) {
  const a = ACCENT[accent];
  return (
    <li className="relative flex gap-4">
      {/* timeline rail */}
      <div className="flex flex-col items-center">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-sm", a.dot)}>
          {index + 1}
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      {/* content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[15px] font-semibold tracking-tight">{step.title}</h4>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <CircleUserRound className="size-3" /> {step.who}
          </span>
          {step.status && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", a.chipBg)}>{step.status}</span>
          )}
        </div>

        <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/80">{step.what}</p>

        {step.gate && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <span><span className="font-semibold">Approval gate:</span> {step.gate}</span>
          </div>
        )}

        {step.auto && step.auto.length > 0 && (
          <ul className="mt-2.5 space-y-1">
            {step.auto.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                <Zap className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
                <span><span className="font-medium text-foreground/70">Automatic:</span> {t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ---- One process card -------------------------------------------------
export function ProcessCard({ process }: { process: Process }) {
  const a = ACCENT[process.accent];
  const Icon = ICONS[process.icon] ?? CircleUserRound;
  return (
    <section id={process.key} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-premium">
      {/* header */}
      <div className={cn("flex items-start gap-3 border-b border-border/50 p-5", a.soft)}>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", a.chipBg)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold tracking-tight">{process.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{process.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {process.handoffIn && (
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border">↳ in: {process.handoffIn}</span>
            )}
            {process.handoffOut && (
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border">out ↦ {process.handoffOut}</span>
            )}
          </div>
        </div>
      </div>

      {/* steps */}
      <ol className="p-5 pt-6">
        {process.steps.map((s, i) => (
          <Step key={i} step={s} index={i} accent={process.accent} isLast={i === process.steps.length - 1} />
        ))}
      </ol>
    </section>
  );
}

// ---- Legend -----------------------------------------------------------
export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground">
      <span className="font-medium text-foreground/70">How to read this:</span>
      <span className="inline-flex items-center gap-1.5"><CircleUserRound className="size-3.5" /> who does it</span>
      <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5 text-violet-500" /> the system does it automatically</span>
      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-amber-500" /> an approval is required</span>
    </div>
  );
}

export function ProcessFlows() {
  return (
    <div className="space-y-6">
      <ValueChain />
      <Legend />
      {/* quick jump */}
      <div className="flex flex-wrap gap-2">
        {PROCESSES.map((p) => {
          const a = ACCENT[p.accent];
          return (
            <a key={p.key} href={`#${p.key}`} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium ring-1 transition-colors hover:opacity-80", a.chipBg, a.ring)}>
              {p.name.split(" — ")[0]}
            </a>
          );
        })}
      </div>
      <div className="space-y-6">
        {PROCESSES.map((p) => (
          <ProcessCard key={p.key} process={p} />
        ))}
      </div>
    </div>
  );
}
