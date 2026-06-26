import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageSquareIcon,
  ListChecksIcon,
  LayoutGridIcon,
  MousePointerClickIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

import { getCatalogSessions, getCatalogStats } from "@/actions/whatsapp-catalog.actions";
import { ResendPromptButton } from "./resend-prompt-button";

export const metadata: Metadata = {
  title: "WhatsApp Catalog Funnel",
  description: "First-inbound auto-brochure sessions and event-type conversion funnel",
};

// ============================================================
// Catalog funnel monitor (Server Component) — gated whatsapp:read.
// Stage breakdown stat tiles + recent sessions table. No money displayed
// (cards are read-only teasers sent over WhatsApp, never persisted here).
// ============================================================

const STAGE_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "outline" | "destructive"
> = {
  PROMPTED: "secondary",
  EVENT_SELECTED: "default",
  CARDS_SENT: "warning",
  CTA_CLICKED: "success",
  CLOSED: "outline",
};

export default async function WhatsAppCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!hasPermission(session.user.role as string, "whatsapp:read")) {
    redirect("/not-authorized");
  }

  const canResend = hasPermission(session.user.role as string, "whatsapp:send");

  const [statsRes, sessionsRes] = await Promise.all([
    getCatalogStats(),
    getCatalogSessions({ page: 1, limit: 30 }),
  ]);

  const stats = statsRes.success ? statsRes.data : null;
  const rows = sessionsRes.success ? sessionsRes.data.rows : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="WHATSAPP · CATALOG FUNNEL"
        title="Catalog Funnel"
        description="When a brand-new number messages us, we auto-reply with an event-type picker, then send tailored package cards and a brochure link. This is that funnel."
      >
        {canResend && <ResendPromptButton />}
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Prompted"
            value={stats.prompted}
            accent="cyan"
            icon={<MessageSquareIcon />}
            sub="event-type picker sent"
          />
          <StatTile
            label="Event selected"
            value={stats.eventSelected + stats.cardsSent + stats.ctaClicked + stats.closed}
            accent="amber"
            icon={<ListChecksIcon />}
            sub={`${stats.selectionRate}% selection rate`}
            pct={stats.selectionRate}
          />
          <StatTile
            label="Cards sent"
            value={stats.cardsSent + stats.ctaClicked + stats.closed}
            accent="violet"
            icon={<LayoutGridIcon />}
            sub="package cards delivered"
          />
          <StatTile
            label="CTA clicked"
            value={stats.ctaClicked + stats.closed}
            accent="emerald"
            icon={<MousePointerClickIcon />}
            sub={`${stats.conversionRate}% conversion`}
            pct={stats.conversionRate}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent catalog sessions</CardTitle>
          <CardDescription>
            One row per inbound number that entered the auto-catalog flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={<MessageSquareIcon />}
              title="No catalog sessions yet"
              description="Sessions appear the moment a new number messages your WhatsApp Business line. Make sure the inbound webhook and an active WhatsApp config are connected in Settings → Integrations."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium tabular-nums">{r.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.contactName ?? "—"}
                    </TableCell>
                    <TableCell>{r.selectedEventType ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STAGE_VARIANT[r.stage] ?? "secondary"}>{r.stage}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.ctaClicked ? (
                        <Badge variant="success">Clicked</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.contactId ? (
                        <Link
                          href={`/contacts/${r.contactId}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
