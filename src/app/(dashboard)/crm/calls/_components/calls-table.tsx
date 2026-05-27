"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PhoneIncoming,
  PhoneOutgoing,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { deleteCallLog } from "@/actions/call.actions";
import { toast } from "sonner";
import {
  CALL_DISPOSITION_LABELS,
  CALL_DISPOSITION_COLORS,
} from "@/lib/constants";

interface CallLogItem {
  id: string;
  disposition: string;
  durationSeconds: number;
  recordingUrl: string | null;
  externalCallId: string | null;
  notes: string | null;
  tags: string[];
  followUpDate: string | null;
  createdAt: string;
  communication: {
    direction: string;
    bookingId: string | null;
  };
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  agent: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface CallsTableProps {
  data: CallLogItem[];
  total: number;
  page: number;
  limit: number;
}

export function CallsTable({ data, total, page, limit }: CallsTableProps) {
  const router = useRouter();
  const totalPages = Math.ceil(total / limit);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCallLog(id);
    if (result.success) {
      toast.success("Call log deleted");
    } else {
      toast.error(result.error || "Failed to delete");
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`/crm/calls?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select onValueChange={(v) => handleFilterChange("direction", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(v) => handleFilterChange("disposition", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Disposition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispositions</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="NO_ANSWER">No Answer</SelectItem>
            <SelectItem value="BUSY">Busy</SelectItem>
            <SelectItem value="VOICEMAIL">Voicemail</SelectItem>
            <SelectItem value="WRONG_NUMBER">Wrong Number</SelectItem>
            <SelectItem value="CALLBACK_REQUESTED">Callback Requested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Contact</TableHead>
              <TableHead className="w-[100px]">Direction</TableHead>
              <TableHead>Disposition</TableHead>
              <TableHead className="w-[100px]">Duration</TableHead>
              <TableHead>Recording</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No call logs found. Log your first call!
                </TableCell>
              </TableRow>
            ) : (
              data.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {log.contact.firstName} {log.contact.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.contact.phone || log.contact.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {log.communication.direction === "INBOUND" ? (
                        <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="text-xs">
                        {log.communication.direction}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        CALL_DISPOSITION_COLORS[log.disposition] || ""
                      }
                    >
                      {CALL_DISPOSITION_LABELS[log.disposition] ||
                        log.disposition}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(log.durationSeconds)}
                  </TableCell>
                  <TableCell>
                    {log.recordingUrl ? (
                      <audio controls preload="none" className="h-8 w-36">
                        <source src={log.recordingUrl} type="audio/mpeg" />
                      </audio>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.agent.name || log.agent.email}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Call Log</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this call log. This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(log.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}&ndash;
            {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("page", String(page - 1));
                router.push(`/crm/calls?${params.toString()}`);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("page", String(page + 1));
                router.push(`/crm/calls?${params.toString()}`);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
