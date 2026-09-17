"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Send,
  Check,
  CheckCheck,
  XCircle,
  ArrowLeft,
  FileText,
  ExternalLink,
  AlertTriangle,
  Phone,
  UserCircle,
  CheckCircle,
  Info,
  UserPlus,
  Paperclip,
  UserX,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getConversation,
  sendWhatsAppMessage,
  getWhatsAppTemplates,
} from "@/actions/whatsapp.actions";
import { createLead, updateLeadStatus, updateLead, getAssignableUsers } from "@/actions/lead.actions";
import type { ConversationSummary } from "@/actions/whatsapp.actions";
import type { LeadStatus } from "@prisma/client";

const LEAD_STATUSES = [
  { value: "NEW", label: "New Lead", color: "bg-blue-500" },
  { value: "NOT_CONNECTED", label: "Not Connected", color: "bg-orange-400" },
  { value: "CONTACTED", label: "Contacted", color: "bg-orange-500" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-purple-500" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent", color: "bg-blue-400" },
  { value: "NEGOTIATION", label: "Opportunity", color: "bg-indigo-500" },
  { value: "WON", label: "Customer", color: "bg-emerald-500" },
  { value: "LOST", label: "Churned", color: "bg-red-500" },
];

// ============================================================
// Inbox Chat View — Right panel of WhatsApp Inbox
// ============================================================

interface WhatsAppMsg {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  templateName: string | null;
  status: string;
  whatsappId: string | null;
  failureReason: string | null;
  sentAt: string;
  contactId: string;
}

interface TemplateDef {
  name: string;
  label: string;
  params: string[];
}

interface InboxChatViewProps {
  conversation: ConversationSummary;
  onBack?: () => void;
}

// Status indicator component
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "READ":
      return <CheckCheck className="size-3.5 text-blue-400" />;
    case "DELIVERED":
      return <CheckCheck className="size-3.5 text-muted-foreground" />;
    case "SENT":
      return <Check className="size-3.5 text-muted-foreground" />;
    case "FAILED":
      return <XCircle className="size-3.5 text-red-400" />;
    default:
      return <Check className="size-3.5 text-muted-foreground" />;
  }
}

export function InboxChatView({ conversation, onBack }: InboxChatViewProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<WhatsAppMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"message" | "template">("message");
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  
  // Track local lead status if updated
  const [currentLeadStatus, setCurrentLeadStatus] = useState<string | undefined>(
    conversation.leadStatus
  );
  // Assignee state
  const [assigneeId, setAssigneeId] = useState<string | null>(conversation.assignedToId ?? null);
  const [assigneeName, setAssigneeName] = useState<string | null>(conversation.assignedToName ?? null);
  const [users, setUsers] = useState<{ id: string; name: string | null; role: string }[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation messages
  const loadMessages = useCallback(async () => {
    try {
      const result = await getConversation(conversation.contactId);
      if (result.success && result.data) {
        // Messages come sorted desc from server, reverse for display
        setMessages([...(result.data as WhatsAppMsg[])].reverse());
        setError(null);
        setLastSyncedAt(new Date());
      } else {
        // Surface persistent sync failures instead of silently showing
        // an empty conversation (E-1).
        setError(result.error || "Failed to refresh messages");
      }
    } catch {
      setError("Failed to refresh messages");
    } finally {
      setLoading(false);
    }
  }, [conversation.contactId]);

  // Load templates
  useEffect(() => {
    getWhatsAppTemplates().then((result) => {
      if (result.success && result.data) {
        setTemplates(result.data as TemplateDef[]);
      }
    });
    // Load assignable users
    getAssignableUsers().then((result) => {
      if (result.success) setUsers(result.data);
    });
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Polling for new messages every 10s
  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Get current template definition
  const currentTemplate = templates.find((t) => t.name === selectedTemplate);

  // Handle send message
  async function handleSend() {
    if (mode === "message" && !messageText.trim()) return;
    if (mode === "template" && !selectedTemplate) return;

    setSending(true);
    try {
      const result = await sendWhatsAppMessage({
        contactId: conversation.contactId,
        content: mode === "message" ? messageText.trim() : undefined,
        templateName: mode === "template" ? selectedTemplate : undefined,
        params: mode === "template" ? templateParams : undefined,
      });

      if (result.success) {
        toast.success("Message sent");
        setMessageText("");
        setSelectedTemplate("");
        setTemplateParams({});
        // Reload messages
        await loadMessages();
      } else {
        toast.error(result.error || "Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  // Handle keyboard shortcut
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  // Handle assignee change
  async function handleAssign(userId: string | null, userName: string | null) {
    if (!conversation.leadId) {
      toast.error("No lead found — set a lead status first to create a lead");
      return;
    }
    setAssigning(true);
    const prev = { id: assigneeId, name: assigneeName };
    setAssigneeId(userId);
    setAssigneeName(userName);
    setAssigneeOpen(false);
    try {
      const result = await updateLead(conversation.leadId, { assignedToId: userId ?? undefined });
      if (result.success) {
        toast.success(userId ? `Assigned to ${userName ?? "rep"}` : "Returned to unassigned");
      } else {
        setAssigneeId(prev.id);
        setAssigneeName(prev.name);
        toast.error(result.error || "Failed to update assignee");
      }
    } catch {
      setAssigneeId(prev.id);
      setAssigneeName(prev.name);
      toast.error("Failed to update assignee");
    } finally {
      setAssigning(false);
    }
  }

  // Handle status update
  async function handleStatusChange(newStatus: string) {
    // Optimistic UI update
    const previousStatus = currentLeadStatus;
    setCurrentLeadStatus(newStatus);
    
    try {
      if (conversation.leadId) {
        const result = await updateLeadStatus(conversation.leadId, newStatus as LeadStatus);
        if (result.success) {
          toast.success("Status updated");
        } else {
          // Revert on failure
          setCurrentLeadStatus(previousStatus);
          toast.error(result.error || "Failed to update status");
        }
      } else {
        // Create new lead if they change status from dropdown and no lead exists
        const createResult = await createLead({
          contactId: conversation.contactId,
          title: `WhatsApp Lead - ${conversation.contactName}`,
          source: "WHATSAPP",
        });
        
        if (createResult.success && createResult.data) {
          // If the selected status is not "NEW" (which is default), update it immediately
          if (newStatus !== "NEW") {
            await updateLeadStatus(createResult.data.id, newStatus as LeadStatus);
          }
          toast.success("Lead created and status updated");
          // Optionally, we could mutate the conversation object here, but it's enough 
          // that the local state shows the correct status now.
        } else {
          setCurrentLeadStatus(previousStatus);
          toast.error(createResult.error || "Failed to create lead");
        }
      }
    } catch {
      setCurrentLeadStatus(previousStatus);
      toast.error("Failed to update status");
    }
  }

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateStr = format(new Date(msg.sentAt), "dd MMM yyyy");
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(msg);
    return acc;
  }, {} as Record<string, WhatsAppMsg[]>);

  // Check 24-hour session window
  const latestInbound = messages.find((m) => m.direction === "INBOUND");
  let isSessionOpen = false;
  let sessionTimeLeft = "";
  if (latestInbound) {
    const diffMs = new Date().getTime() - new Date(latestInbound.sentAt).getTime();
    const msIn24h = 24 * 60 * 60 * 1000;
    if (diffMs < msIn24h) {
      isSessionOpen = true;
      const timeLeftMs = msIn24h - diffMs;
      const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
      sessionTimeLeft = `${hoursLeft}h ${minutesLeft}m`;
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-white dark:bg-zinc-950">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 md:hidden"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium dark:bg-emerald-950 dark:text-emerald-400">
            {conversation.contactName
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{conversation.contactName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            {conversation.contactPhone}
            <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Open</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 hidden sm:flex">


          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={assigning}
                className="h-8 text-xs font-medium bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400"
              >
                <UserCircle className="mr-1.5 size-3" />
                {assigneeName ?? "Assignee"}
                <ChevronDown className="ml-1 size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-0">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b">
                Transfer To
              </div>
              <div className="max-h-64 overflow-y-auto">
                {/* Assign to me */}
                <button
                  onClick={() => {
                    const myId = session?.user?.id ?? null;
                    const myName = session?.user?.name ?? null;
                    handleAssign(myId, myName);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <UserPlus className="size-3.5" />
                  </span>
                  <span className="font-medium">Assign to me</span>
                </button>
                {/* Return to unassigned */}
                <button
                  onClick={() => handleAssign(null, null)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors text-red-600 dark:text-red-400"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                    <UserX className="size-3.5" />
                  </span>
                  <span className="font-medium">Return to unassigned</span>
                </button>
                <div className="my-1 border-t" />
                {/* All users */}
                {users.map((u) => {
                  const initials = (u.name ?? "?")
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();
                  const isAssigned = u.id === assigneeId;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleAssign(u.id, u.name ?? null)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">
                        {initials}
                      </span>
                      <span className="flex-1 text-left">
                        <span className={cn("block font-medium", isAssigned && "text-emerald-600 dark:text-emerald-400")}>
                          {u.name ?? "Unknown"}
                        </span>
                        <span className="block text-[11px] text-muted-foreground capitalize">
                          {u.role.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </span>
                      {isAssigned && (
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" asChild className="h-8 text-xs font-medium bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <Link href={`/contacts/${conversation.contactId}`}>
              <Info className="mr-1.5 size-3" /> Show Info
            </Link>
          </Button>
          <Select
            value={currentLeadStatus || ""}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 dark:hover:bg-emerald-900/50">
              <SelectValue placeholder={currentLeadStatus ? "Status" : "New Lead"} />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground tracking-wider">
                STAGE
              </div>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", status.color)} />
                    {status.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Session Window Banner */}
      {isSessionOpen ? (
        <div className="flex items-center justify-center bg-[#e8f5e9] px-4 py-1.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-900/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          Session open - reply freely for another {sessionTimeLeft}
        </div>
      ) : (
        <div className="flex items-center justify-center bg-zinc-100 px-4 py-1.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
          <AlertTriangle className="size-3 mr-1.5" />
          Session closed - you can only send approved templates
        </div>
      )}

      {/* Sync error banner — surface persistent polling failures (E-1) */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">Failed to refresh messages: {error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-red-700 hover:text-red-800 dark:text-red-300"
            onClick={() => loadMessages()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 bg-[#efeae2] dark:bg-[#0b141a]">
        <div className="mx-auto max-w-3xl space-y-4 p-4 pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="size-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p className="text-xs text-muted-foreground">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-white/50 dark:bg-black/20 rounded-lg max-w-sm mx-auto p-4 shadow-sm">
              {error
                ? "Could not load messages."
                : "No messages yet. Send the first message!"}
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="space-y-2">
                {/* Date Divider */}
                <div className="flex justify-center my-4">
                  <div className="bg-white/90 dark:bg-[#182229]/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-medium text-zinc-600 dark:text-zinc-400 shadow-sm border border-black/5 dark:border-white/5">
                    {date}
                  </div>
                </div>
                
                {/* Messages for this date */}
                {msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[80%] md:max-w-[70%] rounded-lg px-3 py-2 shadow-sm break-words",
                        msg.direction === "OUTBOUND"
                          ? "bg-[#dcf8c6] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-tr-none"
                          : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] rounded-tl-none"
                      )}
                    >
                      {/* Template badge */}
                      {msg.templateName && (
                        <div className="mb-1 flex items-center gap-1 border-b border-black/10 dark:border-white/10 pb-1">
                          <FileText className="size-3 opacity-60" />
                          <span className="text-[10px] font-medium opacity-70 uppercase tracking-wider">
                            Template: {msg.templateName}
                          </span>
                        </div>
                      )}

                      {/* Message content */}
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed pr-12 pb-1">
                        {msg.content}
                      </p>

                      {/* Failure reason */}
                      {msg.direction === "OUTBOUND" &&
                        msg.status === "FAILED" &&
                        msg.failureReason && (
                          <div className="mt-1.5 flex items-start gap-1 rounded bg-red-100/50 dark:bg-red-900/30 px-2 py-1 text-[11px] leading-snug text-red-700 dark:text-red-300">
                            <XCircle className="mt-0.5 size-3 shrink-0" />
                            <span>{msg.failureReason}</span>
                          </div>
                        )}

                      {/* Timestamp + status */}
                      <div
                        className={cn(
                          "absolute bottom-1.5 right-2 flex items-center justify-end gap-1 text-[10px]",
                          msg.direction === "OUTBOUND"
                            ? "text-black/40 dark:text-white/50"
                            : "text-black/40 dark:text-white/50"
                        )}
                      >
                        <span>{format(new Date(msg.sentAt), "HH:mm")}</span>
                        {msg.direction === "OUTBOUND" && (
                          <StatusIcon status={msg.status} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background p-3">
        {/* Mode toggle */}
        <div className="mb-2 flex gap-1">
          <Button
            variant={mode === "message" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("message")}
            className={cn(
              "h-7 text-xs",
              mode === "message" && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            Message
          </Button>
          <Button
            variant={mode === "template" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("template")}
            className={cn(
              "h-7 text-xs",
              mode === "template" && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            Template
          </Button>
        </div>

        {mode === "message" ? (
          <div className="flex gap-2 items-end">
            <Button variant="ghost" size="icon" className="shrink-0 mb-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <Paperclip className="size-5" />
            </Button>
            <Textarea
              placeholder="Type a message... (Ctrl+Enter to send)"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] max-h-[120px] resize-none bg-white dark:bg-zinc-900 !border-none !outline-none !ring-0 focus:!ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 !shadow-none rounded-xl py-3 px-4 focus:!outline-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="shrink-0 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full size-11 mb-0.5 shadow-sm"
              size="icon"
            >
              <Send className="size-5 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Select
              value={selectedTemplate}
              onValueChange={(v) => {
                setSelectedTemplate(v);
                setTemplateParams({});
              }}
            >
              <SelectTrigger className="!border-none !outline-none !ring-0 focus:!ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 !shadow-none bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Template params */}
            {currentTemplate && currentTemplate.params.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {currentTemplate.params.map((param) => (
                  <div key={param} className="space-y-1">
                    <Label className="text-xs capitalize">
                      {param.replace(/([A-Z])/g, " $1").trim()}
                    </Label>
                    <Input
                      placeholder={`Enter ${param}`}
                      value={templateParams[param] ?? ""}
                      onChange={(e) =>
                        setTemplateParams((prev) => ({
                          ...prev,
                          [param]: e.target.value,
                        }))
                      }
                      className="h-8 text-sm !border-none !outline-none !ring-0 focus:!ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 !shadow-none bg-zinc-100 dark:bg-zinc-800 rounded-md"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSend}
                disabled={!selectedTemplate || sending}
                className="bg-emerald-600 hover:bg-emerald-700"
                size="sm"
              >
                <Send className="mr-1.5 size-3.5" />
                {sending ? "Sending..." : "Send Template"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
