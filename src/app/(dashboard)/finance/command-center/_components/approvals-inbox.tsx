// ============================================================
// ApprovalsInbox — DRAFT (unposted) journal entries waiting for a sign-off.
// Read-only: every row links across to /finance to act. Empty = a calm
// "all caught up" EmptyState.
// ============================================================

import Link from "next/link";
import { Inbox, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR, formatDate } from "@/lib/utils";
import type { ApprovalRow } from "@/actions/finance-cockpit.actions";

interface ApprovalsInboxProps {
  approvals: ApprovalRow[];
  count: number;
}

export function ApprovalsInbox({ approvals, count }: ApprovalsInboxProps) {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
            <Inbox className="size-4" />
          </span>
          Approvals inbox
        </CardTitle>
        {count > 0 && (
          <Badge variant="secondary" className="numeric">
            {count} pending
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            tone="success"
            title="All caught up"
            description="No draft entries are waiting for approval."
          />
        ) : (
          <ul className="divide-y">
            {approvals.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="group flex items-center justify-between gap-3 py-2.5 transition-premium hover:bg-muted/50 -mx-2 rounded-md px-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.narration || a.entryNo || "Untitled draft entry"}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {a.entryNo ? `${a.entryNo} · ` : ""}
                      {formatDate(a.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold numeric">{formatINR(a.total)}</span>
                    <ChevronRight className="size-4 text-muted-foreground transition-premium group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
