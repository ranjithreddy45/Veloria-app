"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  sendWhatsAppMessage,
  getWhatsAppTemplates,
} from "@/actions/whatsapp.actions";

// ============================================================
// WhatsApp Quick Send Dialog
// ============================================================

interface WhatsAppQuickSendDialogProps {
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
}

interface TemplateDef {
  name: string;
  label: string;
  params: string[];
}

export function WhatsAppQuickSendDialog({
  contactId,
  contactName,
  contactPhone,
}: WhatsAppQuickSendDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [activeTab, setActiveTab] = useState("message");

  // Load templates when dialog opens
  useEffect(() => {
    if (open && templates.length === 0) {
      getWhatsAppTemplates().then((result) => {
        if (result.success && result.data) {
          setTemplates(result.data as TemplateDef[]);
        }
      });
    }
  }, [open, templates.length]);

  const currentTemplate = templates.find((t) => t.name === selectedTemplate);

  async function handleSend() {
    if (activeTab === "message" && !messageText.trim()) return;
    if (activeTab === "template" && !selectedTemplate) return;

    setSending(true);
    try {
      const result = await sendWhatsAppMessage({
        contactId,
        content: activeTab === "message" ? messageText.trim() : undefined,
        templateName: activeTab === "template" ? selectedTemplate : undefined,
        params: activeTab === "template" ? templateParams : undefined,
      });

      if (result.success) {
        toast.success(`WhatsApp message sent to ${contactName}`);
        setOpen(false);
        resetForm();
      } else {
        toast.error(result.error || "Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setMessageText("");
    setSelectedTemplate("");
    setTemplateParams({});
    setActiveTab("message");
  }

  const canSend =
    activeTab === "message" ? messageText.trim().length > 0 : !!selectedTemplate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          <MessageCircle className="mr-1.5 size-4" />
          WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            Send WhatsApp
          </DialogTitle>
          <DialogDescription>
            Send a WhatsApp message to{" "}
            <span className="font-medium text-foreground">{contactName}</span>
            {contactPhone && (
              <span className="text-muted-foreground"> ({contactPhone})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!contactPhone ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            This contact does not have a phone number. Please add a phone number first.
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="message">Message</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
            </TabsList>

            <TabsContent value="message" className="space-y-3">
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Type your WhatsApp message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  maxLength={4096}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {messageText.length}/4096
                </p>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-3">
              <div className="space-y-2">
                <Label>Template</Label>
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
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-emerald-600" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template params */}
              {currentTemplate && currentTemplate.params.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Parameters
                  </Label>
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
                </div>
              )}

              {/* Template preview */}
              {currentTemplate && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Preview
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentTemplate.params.map((param) => (
                      <Badge key={param} variant="secondary" className="text-[10px]">
                        {`{{${param}}}`}: {templateParams[param] || "—"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sending || !contactPhone}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="mr-1.5 size-3.5" />
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
