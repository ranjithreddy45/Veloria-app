"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { syncApprovedTemplates } from "@/actions/whatsapp.actions";

// ============================================================
// The templates Meta has actually approved.
//
// The list above this one is WHATSAPP_TEMPLATES — a hand-maintained array
// compiled into the app. It has no idea what Meta approved, paused or rejected,
// which is why a template name that looked right could fail silently at send
// time and why nobody could pick from the approved set: there was no set.
//
// This is the synced mirror. It shows status honestly, including the templates
// you CANNOT send, because "PENDING" and "REJECTED" are the answers people are
// looking for when a message did not arrive.
// ============================================================

interface SyncedTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string | null;
  variableCount: number;
  syncedAt: Date | string;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-primary/10 text-primary border-primary/20",
  PENDING: "bg-warning/10 text-warning border-warning/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  PAUSED: "bg-destructive/10 text-destructive border-destructive/20",
  DISABLED: "bg-muted text-muted-foreground border-border",
};

export function SyncedTemplates({ templates }: { templates: SyncedTemplate[] }) {
  const [pending, start] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);

  const approved = templates.filter((t) => t.status === "APPROVED").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">Approved templates (from Meta)</CardTitle>
          <p className="mt-1 text-detail text-muted-foreground">
            Pulled straight from your WhatsApp Business Account.{" "}
            {templates.length > 0 && (
              <>
                <span className="numeric font-medium text-foreground">{approved}</span> of{" "}
                <span className="numeric">{templates.length}</span> can be sent.
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await syncApprovedTemplates();
              if (!res.success) {
                // Meta's own message, verbatim. The two real causes — a token
                // without whatsapp_business_management scope, and a missing or
                // wrong Business Account ID — are only distinguishable from it.
                setLastError(res.error ?? "Sync failed");
                toast.error(res.error ?? "Sync failed");
                return;
              }
              setLastError(null);
              toast.success(
                `Synced ${res.synced} template${res.synced === 1 ? "" : "s"} — ${res.approved} approved` +
                  (res.removed ? `, ${res.removed} no longer on Meta` : "")
              );
            })
          }
        >
          <RefreshCw className={`mr-2 size-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Syncing…" : "Sync from Meta"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-detail">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="text-foreground/80">{lastError}</span>
          </div>
        )}

        {templates.length === 0 ? (
          <p className="text-detail text-muted-foreground">
            Nothing synced yet. Sync needs a Meta <strong>Business Account ID</strong> and an
            access token with the <code>whatsapp_business_management</code> scope — a Weflux API
            key on its own cannot list templates, because the templates live on Meta.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-meta uppercase text-muted-foreground">{t.language}</span>
                    {t.variableCount > 0 && (
                      <span className="text-meta text-muted-foreground">
                        {t.variableCount} variable{t.variableCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {t.body && (
                    <p className="mt-0.5 line-clamp-2 text-detail text-muted-foreground">
                      {t.body}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_TONE[t.status] ?? STATUS_TONE.DISABLED}
                >
                  {t.status === "APPROVED" && <CheckCircle2 className="mr-1 size-3" />}
                  {t.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
