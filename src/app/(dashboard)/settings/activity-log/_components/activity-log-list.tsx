"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  History,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { getActivityLogs } from "@/actions/activity.actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Types
// ============================================================

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ActivityLogListProps {
  initialLogs: ActivityLog[];
  initialPagination: Pagination | null;
  users: { id: string; name: string | null; email: string }[];
}

// ============================================================
// Helpers
// ============================================================

const ENTITY_ROUTES: Record<string, string> = {
  Contact: "/contacts",
  Lead: "/leads",
  Booking: "/bookings",
  Invoice: "/invoices",
  Payment: "/payments",
  Task: "/tasks",
};

const ENTITY_COLORS: Record<string, string> = {
  Contact: "bg-blue-100 text-blue-800 border-blue-200",
  Lead: "bg-purple-100 text-purple-800 border-purple-200",
  Booking: "bg-green-100 text-green-800 border-green-200",
  Invoice: "bg-amber-100 text-amber-800 border-amber-200",
  Payment: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Task: "bg-orange-100 text-orange-800 border-orange-200",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  status_changed: ArrowRightLeft,
};

function getActionLabel(action: string, entityType: string): string {
  switch (action) {
    case "created":
      return `created a ${entityType.toLowerCase()}`;
    case "updated":
      return `updated a ${entityType.toLowerCase()}`;
    case "deleted":
      return `deleted a ${entityType.toLowerCase()}`;
    case "status_changed":
      return `changed status of a ${entityType.toLowerCase()}`;
    default:
      return `${action} a ${entityType.toLowerCase()}`;
  }
}

const ENTITY_TYPES = ["Contact", "Lead", "Booking", "Invoice", "Payment", "Task"];

// ============================================================
// Component
// ============================================================

export function ActivityLogList({
  initialLogs,
  initialPagination,
  users,
}: ActivityLogListProps) {
  const [logs, setLogs] = React.useState<ActivityLog[]>(initialLogs);
  const [pagination, setPagination] = React.useState<Pagination | null>(initialPagination);
  const [entityFilter, setEntityFilter] = React.useState<string>("all");
  const [userFilter, setUserFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(false);

  async function fetchLogs(page: number = 1) {
    setIsLoading(true);
    try {
      const result = await getActivityLogs({
        page,
        limit: 30,
        entityType: entityFilter !== "all" ? entityFilter : undefined,
        userId: userFilter !== "all" ? userFilter : undefined,
      });
      if (result.success) {
        setLogs(result.data.logs);
        setPagination(result.data.pagination);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Re-fetch when filters change
  React.useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, userFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="size-4 text-muted-foreground" />
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name ?? user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="mb-2 size-8" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs">Actions will appear here as they happen.</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const ActionIcon = ACTION_ICONS[log.action] ?? History;
                const entityRoute = ENTITY_ROUTES[log.entityType];
                const entityColor =
                  ENTITY_COLORS[log.entityType] ?? "bg-gray-100 text-gray-800 border-gray-200";
                const initials =
                  log.user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) ?? "??";

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <Avatar className="mt-0.5 size-8">
                      <AvatarFallback className="bg-indigo-100 text-meta text-indigo-700">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {log.user.name ?? log.user.email}
                        </span>{" "}
                        {getActionLabel(log.action, log.entityType)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-meta ${entityColor}`}
                        >
                          {log.entityType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>

                    {entityRoute && log.action !== "deleted" && (
                      <Button size="sm" variant="ghost" asChild className="shrink-0">
                        <Link href={`${entityRoute}/${log.entityId}`}>
                          View
                        </Link>
                      </Button>
                    )}

                    <ActionIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
