"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle,
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  bulkSendWhatsApp,
  getWhatsAppTemplates,
} from "@/actions/whatsapp.actions";

// ============================================================
// Bulk WhatsApp Dialog — Multi-step template sender
// ============================================================

interface BulkWhatsAppDialogProps {
  selectedContactIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TemplateDef {
  name: string;
  label: string;
  params: string[];
}

type Step = "template" | "params" | "sending" | "done";

interface SendResult {
  sent: number;
  failed: number;
  total: number;
  skippedNoPhone: string[];
  duplicateSkipped?: number;
  outcome?: "all" | "partial" | "none";
}

export function BulkWhatsAppDialog({
  selectedContactIds,
  open,
  onOpenChange,
}: BulkWhatsAppDialogProps) {
  const [step, setStep] = useState<Step>("template");
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SendResult | null>(null);

  const currentTemplate = templates.find((t) => t.name === selectedTemplate);

  // Load templates
  useEffect(() => {
    if (open && templates.length === 0) {
      getWhatsAppTemplates().then((res) => {
        if (res.success && res.data) {
          setTemplates(res.data as TemplateDef[]);
        }
      });
    }
  }, [open, templates.length]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep("template");
      setSelectedTemplate("");
      setTemplateParams({});
      setResult(null);
    }
  }, [open]);

  async function handleSend() {
    setStep("sending");

    try {
      const res = await bulkSendWhatsApp({
        contactIds: selectedContactIds,
        templateName: selectedTemplate,
        params: Object.keys(templateParams).length > 0 ? templateParams : undefined,
      });

      if (res.success && res.data) {
        setResult(res.data);
        setStep("done");
        if (res.data.outcome === "none" && res.data.failed > 0) {
          toast.error("All WhatsApp messages failed to send");
        } else if (res.data.sent > 0 && res.data.failed > 0) {
          toast.warning(
            `Sent ${res.data.sent}, ${res.data.failed} failed`
          );
        } else if (res.data.sent > 0) {
          toast.success(`Sent ${res.data.sent} WhatsApp messages`);
        }
      } else {
        toast.error(res.error || "Failed to send messages");
        setStep("params");
      }
    } catch {
      toast.error("Failed to send messages");
      setStep("params");
    }
  }

  const hasParams = currentTemplate && currentTemplate.params.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-success" />
            Bulk WhatsApp
          </DialogTitle>
          <DialogDescription>
            Send a WhatsApp template message to {selectedContactIds.length} selected
            contact{selectedContactIds.length !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Template Selection */}
        {step === "template" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Users className="size-5 text-success" />
              <div>
                <p className="text-sm font-medium">
                  {selectedContactIds.length} contacts selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Messages will be sent to contacts with phone numbers
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(v) => {
                  setSelectedTemplate(v);
                  setTemplateParams({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a message template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-success" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTemplate && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Template: {currentTemplate.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {currentTemplate.params.map((p) => (
                    <Badge key={p} variant="secondary" className="text-meta">
                      {`{{${p}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Fill Params */}
        {step === "params" && currentTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4 text-success" />
              Template: <span className="font-medium text-foreground">{currentTemplate.label}</span>
            </div>

            {hasParams ? (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">
                  Fill in template parameters
                </Label>
                {currentTemplate.params.map((param) => (
                  <div key={param} className="space-y-1">
                    <Label className="text-sm capitalize">
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
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This template has no parameters. Ready to send!
              </p>
            )}
          </div>
        )}

        {/* Step: Sending */}
        {step === "sending" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-success border-t-transparent" />
              <p className="text-sm font-medium">
                Sending to {selectedContactIds.length} contacts...
              </p>
              <Progress value={50} className="h-2 w-48" />
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 className="size-12 text-success" />
              <p className="text-lg font-semibold">Messages Sent!</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-success/10 p-3 text-center">
                <p className="text-2xl font-bold text-success">
                  {result.sent}
                </p>
                <p className="text-xs text-success">Sent</p>
              </div>
              <div className="rounded-lg border bg-destructive/10 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">
                  {result.failed}
                </p>
                <p className="text-xs text-destructive">Failed</p>
              </div>
              <div className="rounded-lg border bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {result.skippedNoPhone.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="text-xs font-medium text-warning">
                    Skipped (no phone number):
                  </p>
                  <p className="text-xs text-warning">
                    {result.skippedNoPhone.join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "template" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep(hasParams ? "params" : "params")}
                disabled={!selectedTemplate}
                className="bg-success hover:bg-success/90"
              >
                {hasParams ? "Next: Fill Params" : "Next: Confirm"}
              </Button>
            </>
          )}
          {step === "params" && (
            <>
              <Button variant="outline" onClick={() => setStep("template")}>
                Back
              </Button>
              <Button
                onClick={handleSend}
                className="bg-success hover:bg-success/90"
              >
                <Send className="mr-1.5 size-3.5" />
                Send to {selectedContactIds.length} Contacts
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
