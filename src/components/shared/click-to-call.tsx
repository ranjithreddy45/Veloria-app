"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import { CallDispositionDialog } from "@/app/(dashboard)/crm/calls/_components/call-disposition-dialog";
import { cn } from "@/lib/utils";
import { initiateCall } from "@/actions/telephony.actions";
import { toast } from "sonner";

interface ClickToCallProps {
  phone: string;
  contactId: string;
  contactName: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  showLabel?: boolean;
}

export function ClickToCall({
  phone,
  contactId,
  contactName,
  size = "sm",
  variant = "outline",
  className,
  showLabel = false,
}: ClickToCallProps) {
  const [showDisposition, setShowDisposition] = useState(false);
  const [externalCallId, setExternalCallId] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const handleCall = () => {
    startTransition(async () => {
      try {
        // Try initiating call via telephony provider
        const result = await initiateCall({ contactId, phoneNumber: phone });

        if (result.success && result.data) {
          toast.success(`Call initiated via ${result.data.provider}`);
          setExternalCallId(result.data.externalCallId);
          // Show disposition dialog - the call was auto-logged, agent can update disposition later
          setShowDisposition(true);
        } else if (result.error === "NO_CONFIG") {
          // No telephony configured - fall back to native dialer
          window.open(`tel:${phone}`, "_self");
          setTimeout(() => setShowDisposition(true), 1000);
        } else {
          // Telephony error - fall back to native dialer
          toast.error(result.error || "Call failed, opening dialer...");
          window.open(`tel:${phone}`, "_self");
          setTimeout(() => setShowDisposition(true), 1000);
        }
      } catch {
        // Fallback to native dialer
        window.open(`tel:${phone}`, "_self");
        setTimeout(() => setShowDisposition(true), 1000);
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={handleCall}
        disabled={isPending}
        title={`Call ${phone}`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Phone className="h-3.5 w-3.5" />
        )}
        {showLabel && <span>{phone}</span>}
      </Button>

      {showDisposition && (
        <CallDispositionDialog
          contactId={contactId}
          contactName={contactName}
          externalCallId={externalCallId}
        />
      )}
    </div>
  );
}
