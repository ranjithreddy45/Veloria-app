"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  Send,
  Check,
  CheckCheck,
  XCircle,
  ArrowLeft,
  FileText,
  ExternalLink,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getConversation,
  sendWhatsAppMessage,
  getWhatsAppTemplates,
} from "@/actions/whatsapp.actions";
import type { ConversationSummary } from "@/actions/whatsapp.actions";

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
      return <CheckCheck className="size-3.5 text-zinc-400" />;
    case "SENT":
      return <Check className="size-3.5 text-zinc-400" />;
    case "FAILED":
      return <XCircle className="size-3.5 text-red-400" />;
    default:
      return <Check className="size-3.5 text-zinc-400" />;
  }
}

export function InboxChatView({ conversation, onBack }: InboxChatViewProps) {
  const [messages, setMessages] = useState<WhatsAppMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"message" | "template">("message");
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation messages
  const loadMessages = useCallback(async () => {
    const result = await getConversation(conversation.contactId);
    if (result.success && result.data) {
      // Messages come sorted desc from server, reverse for display
      setMessages([...(result.data as WhatsAppMsg[])].reverse());
    }
    setLoading(false);
  }, [conversation.contactId]);

  // Load templates
  useEffect(() => {
    getWhatsAppTemplates().then((result) => {
      if (result.success && result.data) {
        setTemplates(result.data as TemplateDef[]);
      }
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
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
          <p className="text-xs text-muted-foreground">{conversation.contactPhone}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/contacts/${conversation.contactId}`}>
            <ExternalLink className="mr-1.5 size-3.5" />
            View Contact
          </Link>
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-[#f0f2f5] dark:bg-zinc-950/50">
        <div className="mx-auto max-w-3xl space-y-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="size-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No messages yet. Send the first message!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                    msg.direction === "OUTBOUND"
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  )}
                >
                  {/* Template badge */}
                  {msg.templateName && (
                    <div className="mb-1 flex items-center gap-1">
                      <FileText className="size-3 opacity-70" />
                      <span className="text-[10px] font-medium opacity-70">
                        {msg.templateName}
                      </span>
                    </div>
                  )}

                  {/* Message content */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>

                  {/* Failure reason — surface why a send failed instead of a
                      silent error (E-3). */}
                  {msg.direction === "OUTBOUND" &&
                    msg.status === "FAILED" &&
                    msg.failureReason && (
                      <div className="mt-1.5 flex items-start gap-1 rounded bg-red-50 px-2 py-1 text-[11px] leading-snug text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        <XCircle className="mt-0.5 size-3 shrink-0" />
                        <span>{msg.failureReason}</span>
                      </div>
                    )}

                  {/* Timestamp + status */}
                  <div
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1",
                      msg.direction === "OUTBOUND"
                        ? "text-emerald-200"
                        : "text-zinc-400 dark:text-zinc-500"
                    )}
                  >
                    <span className="text-[10px]">
                      {format(new Date(msg.sentAt), "dd MMM, HH:mm")}
                    </span>
                    {msg.direction === "OUTBOUND" && (
                      <StatusIcon status={msg.status} />
                    )}
                  </div>
                </div>
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
          <div className="flex gap-2">
            <Textarea
              placeholder="Type a message... (Ctrl+Enter to send)"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
              size="icon"
            >
              <Send className="size-4" />
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
              <SelectTrigger>
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
                      className="h-8 text-sm"
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
