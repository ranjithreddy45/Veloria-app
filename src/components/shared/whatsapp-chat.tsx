"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WHATSAPP_STATUS_COLORS } from "@/lib/constants";
import {
  sendWhatsAppMessage,
  getConversation,
  getWhatsAppTemplates,
} from "@/actions/whatsapp.actions";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface WhatsAppMessageData {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  templateName: string | null;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  whatsappId: string | null;
  sentAt: string;
  contactId: string;
}

interface TemplateData {
  name: string;
  label: string;
  params: string[];
}

interface WhatsAppChatProps {
  contactId: string;
  contactPhone?: string;
}

// ============================================================
// WhatsApp Chat Component
// ============================================================

export function WhatsAppChat({ contactId, contactPhone }: WhatsAppChatProps) {
  const [messages, setMessages] = useState<WhatsAppMessageData[]>([]);
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [mode, setMode] = useState<"custom" | "template">("custom");
  const [customMessage, setCustomMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>(
    {}
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch conversation and templates on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [convoResult, templatesResult] = await Promise.all([
        getConversation(contactId),
        getWhatsAppTemplates(),
      ]);

      if (convoResult.success) {
        setMessages(convoResult.data as WhatsAppMessageData[]);
      }
      if (templatesResult.success) {
        setTemplates(templatesResult.data as TemplateData[]);
      }
      setLoading(false);
    }

    fetchData();
  }, [contactId]);

  // Get selected template's param list
  const activeTemplate = templates.find((t) => t.name === selectedTemplate);

  // Handle sending message
  function handleSend() {
    setError(null);

    startTransition(async () => {
      const payload =
        mode === "template"
          ? {
              contactId,
              templateName: selectedTemplate,
              params:
                Object.keys(templateParams).length > 0
                  ? templateParams
                  : undefined,
            }
          : { contactId, content: customMessage };

      const result = await sendWhatsAppMessage(payload);

      if (result.success) {
        setCustomMessage("");
        setSelectedTemplate("");
        setTemplateParams({});
        // Refresh conversation
        const convoResult = await getConversation(contactId);
        if (convoResult.success) {
          setMessages(convoResult.data as WhatsAppMessageData[]);
        }
      } else {
        setError(result.error);
      }
    });
  }

  const canSend =
    mode === "custom"
      ? customMessage.trim().length > 0
      : selectedTemplate.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="size-5 text-success" />
            WhatsApp
          </CardTitle>
          {contactPhone && (
            <span className="text-xs text-muted-foreground">
              {contactPhone}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message List */}
        <div className="flex max-h-80 min-h-[160px] flex-col-reverse gap-2 overflow-y-auto rounded-lg border bg-muted p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="mb-2 size-8 opacity-40" />
              No messages yet
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1 max-w-[80%]",
                  msg.direction === "OUTBOUND"
                    ? "ml-auto items-end"
                    : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    msg.direction === "OUTBOUND"
                      ? "bg-success text-white"
                      : "bg-card text-foreground border"
                  )}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.sentAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border text-[9px] px-1 py-0",
                      WHATSAPP_STATUS_COLORS[msg.status] ??
                        "bg-muted text-foreground border-border"
                    )}
                  >
                    {msg.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Send Form */}
        <div className="space-y-3">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("custom")}
            >
              Custom Message
            </Button>
            <Button
              variant={mode === "template" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("template")}
            >
              Template
            </Button>
          </div>

          {mode === "custom" ? (
            <Textarea
              placeholder="Type your message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          ) : (
            <div className="space-y-3">
              <Select
                value={selectedTemplate}
                onValueChange={(value) => {
                  setSelectedTemplate(value);
                  setTemplateParams({});
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeTemplate &&
                activeTemplate.params.map((param) => (
                  <div key={param} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {param}
                    </label>
                    <input
                      type="text"
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder={`Enter ${param}`}
                      value={templateParams[param] || ""}
                      onChange={(e) =>
                        setTemplateParams((prev) => ({
                          ...prev,
                          [param]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSend}
            disabled={!canSend || isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 size-4" />
                Send Message
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
