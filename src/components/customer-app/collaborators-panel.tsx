"use client";

// ============================================================
// CollaboratorsPanel — the team's view of who a client shared a booking with
// in the customer app (BookingCollaborator rows: the same rows the host sees on
// /app/event/share, described with the same words). Revoke is offered only when
// the server said the viewer holds bookings:update; revokeCollaboratorAsTeam
// checks it again and writes an ActivityLog entry against the booking.
//
// Mount on the booking page with data from getBookingCollaboratorsForTeam.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { COLLABORATOR_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import {
  revokeCollaboratorAsTeam,
  type TeamCollaboratorRow,
  type TeamCollaboratorsData,
} from "@/actions/guest-collaborators.actions";

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  INVITED: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  REVOKED: "bg-muted text-muted-foreground border-border",
};

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  data: TeamCollaboratorsData;
  className?: string;
}

export function CollaboratorsPanel({ data, className }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Shown straight away; router.refresh() then reloads the saved rows.
  const [revoked, setRevoked] = useState<Record<string, string>>({});

  async function revoke(row: TeamCollaboratorRow) {
    const who = row.name || row.phone;
    if (!window.confirm(`Revoke ${who}'s access to this booking in the customer app? The client can invite them again.`)) return;
    setBusyId(row.id);
    try {
      const res = await revokeCollaboratorAsTeam(row.id);
      if (res.success) {
        setRevoked((r) => ({ ...r, [row.id]: new Date().toISOString() }));
        toast.success(`${who} no longer has access`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  const rows: TeamCollaboratorRow[] = data.rows.map((r) =>
    revoked[r.id] && r.status !== "REVOKED"
      ? { ...r, status: "REVOKED", statusLabel: customerLabel(COLLABORATOR_STATUS_LABEL, "REVOKED"), revokedAt: revoked[r.id] }
      : r
  );

  return (
    <Card className={cn("rounded-2xl shadow-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Family &amp; co-hosts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          People the client shared this booking with in the customer app. Co-hosts can manage the guest list and their own
          to-dos; view-only people can just look. Neither sees payments or documents. Revoking removes access straight away.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">The client hasn&apos;t shared this booking with anyone.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[170px]">Name</TableHead>
                  <TableHead className="min-w-[150px]">Phone</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[220px]">Dates</TableHead>
                  {data.canRevoke && <TableHead className="w-[110px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.name || "—"}</p>
                      {r.loginName && <p className="text-xs text-muted-foreground">Signed in as {r.loginName}</p>}
                    </TableCell>
                    <TableCell className="numeric text-sm">{r.phone}</TableCell>
                    <TableCell className="text-sm">{r.roleLabel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASS[r.status] ?? ""}>
                        {r.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        Invited {day(r.invitedAt)}
                        {r.invitedByName ? ` by ${r.invitedByName}` : ""}
                      </p>
                      {r.acceptedAt && <p>Signed in {day(r.acceptedAt)}</p>}
                      {r.revokedAt && <p>Removed {day(r.revokedAt)}</p>}
                    </TableCell>
                    {data.canRevoke && (
                      <TableCell>
                        {r.status !== "REVOKED" && (
                          <Button variant="outline" size="sm" onClick={() => revoke(r)} disabled={busyId === r.id}>
                            {busyId === r.id && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
