"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  CheckCheck,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  User,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import {
  sendSmsToNumber,
  sendSmsToContact,
  getSmsMessages,
  getSmsContactOptions,
  type SmsMessageRow,
  type SmsStatsData,
} from "@/actions/sms.actions";

// ============================================================
// SMS Console — stats, compose, recent messages
// ============================================================

interface SmsConsoleProps {
  initialMessages: SmsMessageRow[];
  initialStats: SmsStatsData | null;
}

type ContactOption = { id: string; name: string; phone: string };

const STAT_CARDS = [
  {
    key: "sent" as const,
    label: "Sent",
    icon: Send,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    key: "delivered" as const,
    label: "Delivered",
    icon: CheckCheck,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    key: "failed" as const,
    label: "Failed",
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
  },
];

function statusBadge(status: SmsMessageRow["status"]) {
  switch (status) {
    case "SENT":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Sent</Badge>;
    case "DELIVERED":
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Delivered</Badge>;
    case "QUEUED":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Queued</Badge>;
    case "FAILED":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatWhen(iso: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SmsConsole({ initialMessages, initialStats }: SmsConsoleProps) {
  const [messages, setMessages] = useState<SmsMessageRow[]>(initialMessages);
  const [stats] = useState<SmsStatsData | null>(initialStats);
  const [isPending, startTransition] = useTransition();

  // Compose state
  const [mode, setMode] = useState<"number" | "contact">("number");
  const [toNumber, setToNumber] = useState("");
  const [body, setBody] = useState("");

  // Contact picker
  const [contactQuery, setContactQuery] = useState("");
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const configured = stats?.configured ?? false;

  async function refreshMessages() {
    const result = await getSmsMessages();
    if (result.success && result.data) setMessages(result.data);
  }

  async function searchContacts(q: string) {
    setContactQuery(q);
    if (q.trim().length < 2) {
      setContactOptions([]);
      return;
    }
    setSearchingContacts(true);
    const result = await getSmsContactOptions(q.trim());
    setSearchingContacts(false);
    if (result.success && result.data) setContactOptions(result.data);
  }

  function handleSend() {
    if (!body.trim()) {
      toast.error("Enter a message body");
      return;
    }

    startTransition(async () => {
      let result;
      if (mode === "contact") {
        if (!selectedContact) {
          toast.error("Pick a contact");
          return;
        }
        result = await sendSmsToContact({ contactId: selectedContact.id, body });
      } else {
        if (!toNumber.trim()) {
          toast.error("Enter a phone number");
          return;
        }
        result = await sendSmsToNumber({ toNumber, body });
      }

      if (result.success) {
        toast.success("SMS sent");
        setBody("");
      } else {
        toast.error(result.error || "Failed to send SMS");
      }

      // Either way, refresh — failures are recorded as rows too.
      await refreshMessages();
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="SMS"
        description="Send transactional text messages to contacts and track delivery."
      />

      {/* Not-configured banner */}
      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">SMS provider not configured</p>
            <p className="text-xs text-amber-700 dark:text-amber-400/90">
              Set <code className="font-mono">SMS_PROVIDER</code> (MSG91 or TWILIO)
              and the matching provider keys in your environment. Until then,
              outgoing messages are recorded as failed with the reason shown on
              each row.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", card.bg)}>
                  <Icon className={cn("size-5", card.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-lg font-bold">{stats?.[card.key] ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Compose */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" />
              Compose SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient mode toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("number")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                  mode === "number" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                <Hash className="size-3.5" /> Number
              </button>
              <button
                type="button"
                onClick={() => setMode("contact")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                  mode === "contact" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                <User className="size-3.5" /> Contact
              </button>
            </div>

            {mode === "number" ? (
              <div className="space-y-1.5">
                <Label htmlFor="sms-to">Phone number</Label>
                <Input
                  id="sms-to"
                  placeholder="+91 98765 43210"
                  value={toNumber}
                  onChange={(e) => setToNumber(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="sms-contact">Contact</Label>
                {selectedContact ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{selectedContact.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{selectedContact.phone}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedContact(null);
                        setContactQuery("");
                        setContactOptions([]);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="sms-contact"
                      placeholder="Search name or phone…"
                      value={contactQuery}
                      onChange={(e) => searchContacts(e.target.value)}
                    />
                    {searchingContacts && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Searching…
                      </p>
                    )}
                    {contactOptions.length > 0 && (
                      <div className="max-h-44 overflow-y-auto rounded-md border">
                        {contactOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedContact(c);
                              setContactOptions([]);
                            }}
                            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60"
                          >
                            <span className="truncate font-medium">{c.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sms-body">Message</Label>
              <Textarea
                id="sms-body"
                placeholder="Type your SMS…"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
              />
              <p className="text-right text-xs text-muted-foreground">{body.length} chars</p>
            </div>

            <Button onClick={handleSend} disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Send SMS
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent messages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent messages</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <MessageSquare className="size-8 opacity-40" />
                <p className="text-sm">No SMS messages yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">To</th>
                      <th className="pb-2 pr-3 font-medium">Message</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((m) => (
                      <tr key={m.id} className="border-b last:border-0 align-top">
                        <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                          {m.toNumber || "--"}
                        </td>
                        <td className="max-w-xs py-2.5 pr-3">
                          <p className="truncate">{m.content}</p>
                          {m.status === "FAILED" && m.failureReason && (
                            <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
                              {m.failureReason}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">{statusBadge(m.status)}</td>
                        <td className="py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatWhen(m.sentAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
