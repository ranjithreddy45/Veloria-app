import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlugZap, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getIntegrationHealth, summarise } from "@/lib/integrations/health";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Integration Health" };
// Reads live environment + config; must never be cached.
export const dynamic = "force-dynamic";

// ============================================================
// What is actually connected.
//
// Built after an audit found 42 environment variables the code reads that are
// absent in production — including the credential for every outbound
// integration. None of it surfaced anywhere, because each integration degrades
// silently when its key is missing, so the symptom presented as "the APIs keep
// failing" rather than "nothing is configured".
//
// This page exists so that can never be true again. It states, for every
// integration, whether it is live and — when it is not — the exact variable
// names required and what silently does not happen meanwhile.
// ============================================================

const TONE: Record<string, { cls: string; icon: typeof CheckCircle2; label: string }> = {
  LIVE: {
    cls: "border-primary/30 bg-primary/5",
    icon: CheckCircle2,
    label: "Live",
  },
  PARTIAL: {
    cls: "border-warning/40 bg-warning/10",
    icon: AlertTriangle,
    label: "Partly configured",
  },
  NOT_CONFIGURED: {
    cls: "border-destructive/30 bg-destructive/10",
    icon: XCircle,
    label: "Not configured",
  },
};

export default async function IntegrationHealthPage() {
  const session = await auth();
  // Credential NAMES are infrastructure detail, not customer data — but they
  // still describe how this deployment is wired, so keep it behind the same
  // gate as the rest of settings.
  if (!session?.user || !hasPermission(session.user.role as string, "settings:read")) {
    redirect("/dashboard");
  }

  const rows = await getIntegrationHealth();
  const s = summarise(rows);

  const byCategory = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PlugZap}
        accent="blue"
        eyebrow="Settings · Integrations"
        title="Integration Health"
        description="Which external services this deployment is actually connected to — and exactly what is missing for the ones it is not."
      />

      <div className="flex flex-wrap items-center gap-3 text-body">
        <span className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
          <span className="numeric font-semibold">{s.live}</span> live
        </span>
        {s.partial > 0 && (
          <span className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5">
            <span className="numeric font-semibold">{s.partial}</span> partly configured
          </span>
        )}
        {s.off > 0 && (
          <span className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5">
            <span className="numeric font-semibold text-destructive">{s.off}</span> not configured
          </span>
        )}
      </div>

      {s.off + s.partial > 0 && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-body text-muted-foreground">
          Anything below that is not live fails <strong>silently</strong> — the code
          catches the missing credential and carries on, so no error reaches a
          screen or a log anyone reads. That is why unconfigured integrations
          look like intermittent API faults. Add the named variables in the
          hosting environment settings and redeploy; nothing in the code needs
          to change.
        </p>
      )}

      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-body font-semibold tracking-[-0.01em] text-foreground">
            {category}
          </h2>
          <ul className="space-y-2">
            {items.map((r) => {
              const tone = TONE[r.state];
              const Icon = tone.icon;
              return (
                <li
                  key={r.key}
                  className={cn("rounded-lg border px-4 py-3", tone.cls)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        r.state === "LIVE"
                          ? "text-primary"
                          : r.state === "PARTIAL"
                            ? "text-warning"
                            : "text-destructive"
                      )}
                    />
                    <span className="font-semibold text-foreground">{r.label}</span>
                    <span className="text-meta uppercase tracking-wide text-muted-foreground">
                      {tone.label}
                    </span>
                  </div>

                  <p className="mt-1 text-detail text-foreground/80">{r.detail}</p>

                  {r.missing.length > 0 && (
                    <p className="mt-2 text-detail">
                      <span className="text-muted-foreground">Needs: </span>
                      {r.missing.map((m, i) => (
                        <span key={m}>
                          {i > 0 && <span className="text-muted-foreground">, </span>}
                          <code className="rounded bg-background/70 px-1 py-0.5">{m}</code>
                        </span>
                      ))}
                    </p>
                  )}

                  {r.state !== "LIVE" && (
                    <p className="mt-1.5 text-detail text-muted-foreground">
                      While off: {r.impact}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
