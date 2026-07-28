"use client";

import { CheckCircle2, XCircle, Clock, ArrowUpDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ============================================================
// Calendar Sync Status — Shows recent sync activity
// ============================================================

const MOCK_SYNC_LOG = [
  {
    id: "1",
    action: "Created event",
    booking: "Wedding Reception — BK-2026-0045",
    status: "success",
    timestamp: "2 min ago",
  },
  {
    id: "2",
    action: "Updated event",
    booking: "Corporate Gala — BK-2026-0042",
    status: "success",
    timestamp: "15 min ago",
  },
  {
    id: "3",
    action: "Deleted event",
    booking: "Birthday Party — BK-2026-0039",
    status: "success",
    timestamp: "1 hour ago",
  },
  {
    id: "4",
    action: "Sync failed",
    booking: "Anniversary Dinner — BK-2026-0038",
    status: "failed",
    timestamp: "2 hours ago",
  },
  {
    id: "5",
    action: "Created event",
    booking: "Product Launch — BK-2026-0037",
    status: "success",
    timestamp: "3 hours ago",
  },
];

export function CalendarSyncStatus() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-5 text-blue-600" />
          <div>
            <CardTitle className="text-lg">Sync Activity</CardTitle>
            <CardDescription>
              Recent Google Calendar synchronization events
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {MOCK_SYNC_LOG.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              {log.status === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="size-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{log.action}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {log.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {log.booking}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {log.timestamp}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
