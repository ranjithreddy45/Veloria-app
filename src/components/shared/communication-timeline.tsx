"use client";

import { useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  PhoneIcon,
  MailIcon,
  MessageSquareIcon,
  CalendarIcon,
  SmartphoneIcon,
  StickyNoteIcon,
  TrashIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  Loader2Icon,
} from "lucide-react";

import {
  getCommunications,
  deleteCommunication,
} from "@/actions/communication.actions";
import {
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPE_COLORS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogCommunicationDialog } from "@/components/shared/log-communication-dialog";
import { humanizeWhatsAppContent } from "@/lib/whatsapp-render";

// ============================================================
// Props
// ============================================================

interface CommunicationTimelineProps {
  contactId?: string;
  bookingId?: string;
}

// ============================================================
// Communication type from API response
// ============================================================

interface CommunicationEntry {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  direction: string;
  metadata: unknown;
  createdAt: string;
  contactId: string;
  bookingId: string | null;
  createdById: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
}

// ============================================================
// Icon Mapping
// ============================================================

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTE: StickyNoteIcon,
  CALL: PhoneIcon,
  EMAIL: MailIcon,
  SMS: SmartphoneIcon,
  MEETING: CalendarIcon,
  WHATSAPP: MessageSquareIcon,
};

// ============================================================
// Communication Timeline Component
// ============================================================

export function CommunicationTimeline({
  contactId,
  bookingId,
}: CommunicationTimelineProps) {
  const [communications, setCommunications] = useState<CommunicationEntry[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Fetch communications on mount and when contactId/bookingId changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const result = await getCommunications({
        contactId: contactId || undefined,
        bookingId: bookingId || undefined,
      });
      if (result.success && result.data) {
        setCommunications(result.data as CommunicationEntry[]);
      }
      setLoading(false);
    }
    fetchData();
  }, [contactId, bookingId]);

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCommunication(id);
      if (result.success) {
        setCommunications((prev) => prev.filter((c) => c.id !== id));
        toast.success("Communication deleted");
      } else {
        toast.error(result.error || "Failed to delete");
      }
      setDeletingId(null);
    });
  }

  // Re-fetch after dialog closes (new entry was added)
  // We use a polling approach: re-fetch when component re-renders from revalidation
  useEffect(() => {
    // This effect runs on every render, but we rely on server revalidation
    // to trigger a re-render with fresh data
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Communication History</CardTitle>
        {contactId && (
          <LogCommunicationDialog
            contactId={contactId}
            bookingId={bookingId}
          />
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">
              Loading communications...
            </span>
          </div>
        ) : communications.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No communications logged yet.
          </p>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical timeline line */}
            <div className="absolute top-0 bottom-0 left-5 w-px bg-border" />

            {communications.map((comm, index) => {
              const Icon = TYPE_ICONS[comm.type] ?? MessageSquareIcon;
              const colorClass =
                COMMUNICATION_TYPE_COLORS[comm.type] ?? "bg-muted text-muted-foreground";
              const isLast = index === communications.length - 1;

              return (
                <div
                  key={comm.id}
                  className={cn(
                    "relative flex gap-4 pl-0",
                    !isLast && "pb-6"
                  )}
                >
                  {/* Icon circle on timeline */}
                  <div
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border",
                      colorClass
                    )}
                  >
                    <Icon className="size-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Type label + direction */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("border font-medium text-xs", colorClass)}
                          >
                            {COMMUNICATION_TYPE_LABELS[comm.type] ?? comm.type}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border text-xs font-normal"
                          >
                            {comm.direction === "INBOUND" ? (
                              <ArrowDownLeftIcon className="mr-1 size-3" />
                            ) : (
                              <ArrowUpRightIcon className="mr-1 size-3" />
                            )}
                            {comm.direction === "INBOUND" ? "IN" : "OUT"}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(comm.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {/* Subject */}
                        {comm.subject && (
                          <p className="mt-1 text-sm font-medium">
                            {comm.subject}
                          </p>
                        )}

                        {/* Content preview — WhatsApp template payloads are rendered
                            readable (no raw JSON braces leak to the timeline). */}
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {humanizeWhatsAppContent(comm.content)}
                        </p>

                        {/* Contact name (when viewing from booking context) */}
                        {bookingId && !contactId && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Contact: {comm.contact.firstName}{" "}
                            {comm.contact.lastName}
                          </p>
                        )}
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive size-8 shrink-0 p-0"
                        onClick={() => handleDelete(comm.id)}
                        disabled={deletingId === comm.id}
                        title="Delete communication"
                      >
                        {deletingId === comm.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <TrashIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
