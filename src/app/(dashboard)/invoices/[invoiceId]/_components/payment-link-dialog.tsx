"use client";

import { useState } from "react";
import {
  LinkIcon,
  Copy,
  Check,
  MessageCircle,
  Mail,
  ExternalLink,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { generatePaymentLink } from "@/actions/payment.actions";

// ============================================================
// Payment Link Dialog — Generate & share Razorpay payment links
// ============================================================

interface PaymentLinkDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
}

interface PaymentLinkData {
  shortUrl: string;
  amount: number;
  invoiceNumber: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  mode: "razorpay" | "portal";
}

export function PaymentLinkDialog({
  invoiceId,
  invoiceNumber,
  balanceDue,
}: PaymentLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [linkData, setLinkData] = useState<PaymentLinkData | null>(null);
  const [copied, setCopied] = useState(false);
  const [acceptPartial, setAcceptPartial] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generatePaymentLink(invoiceId, {
        acceptPartial,
        notifyCustomer,
        expiresInDays: 7,
      });

      if (result.success && result.data) {
        setLinkData(result.data);
        toast.success("Payment link generated!");
      } else {
        toast.error(result.error || "Failed to generate link");
      }
    } catch {
      toast.error("Failed to generate payment link");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!linkData) return;
    try {
      await navigator.clipboard.writeText(linkData.shortUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  function handleShareWhatsApp() {
    if (!linkData) return;
    const message = encodeURIComponent(
      `Hi ${linkData.contactName}, here's the payment link for Invoice ${linkData.invoiceNumber} (${formatINR(linkData.amount)}):\n\n${linkData.shortUrl}`
    );
    const phone = linkData.contactPhone?.replace(/\D/g, "") ?? "";
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  }

  function handleShareEmail() {
    if (!linkData) return;
    const subject = encodeURIComponent(
      `Payment Link — Invoice ${linkData.invoiceNumber}`
    );
    const body = encodeURIComponent(
      `Dear ${linkData.contactName},\n\nPlease find the payment link for Invoice ${linkData.invoiceNumber}:\n\nAmount: ${formatINR(linkData.amount)}\nLink: ${linkData.shortUrl}\n\nThis link expires in 7 days.\n\nThank you.`
    );
    window.open(`mailto:${linkData.contactEmail ?? ""}?subject=${subject}&body=${body}`, "_blank");
  }

  function handleReset() {
    setLinkData(null);
    setCopied(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 size-4" />
          Payment Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-5 text-indigo-600" />
            Payment Link
          </DialogTitle>
          <DialogDescription>
            Generate a shareable payment link for Invoice {invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        {!linkData ? (
          /* Generate Form */
          <div className="space-y-5">
            {/* Amount display */}
            <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:from-indigo-950/30 dark:to-violet-950/30">
              <p className="text-xs text-muted-foreground">Balance Due</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {formatINR(balanceDue)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Invoice {invoiceNumber}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Accept partial payments</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow customers to pay any amount
                  </p>
                </div>
                <Switch
                  checked={acceptPartial}
                  onCheckedChange={setAcceptPartial}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Notify customer</Label>
                  <p className="text-xs text-muted-foreground">
                    Send SMS & email automatically
                  </p>
                </div>
                <Switch
                  checked={notifyCustomer}
                  onCheckedChange={setNotifyCustomer}
                />
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {generating ? (
                <>
                  <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 size-4" />
                  Generate Payment Link
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Link Generated */
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
              <Check className="size-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Payment link ready!
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Customer pays securely via Razorpay on the portal
                </p>
              </div>
            </div>

            {/* Link + copy */}
            <div className="flex items-center gap-2">
              <Input
                value={linkData.shortUrl}
                readOnly
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>

            {/* Amount + Contact */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {formatINR(linkData.amount)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                for {linkData.contactName}
              </span>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
              >
                <MessageCircle className="mr-1.5 size-3.5" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareEmail}
              >
                <Mail className="mr-1.5 size-3.5" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(linkData.shortUrl, "_blank")}
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                Open
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
