"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SendIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { resendCatalogPrompt } from "@/actions/whatsapp-catalog.actions";

// ============================================================
// Manual re-trigger of the event-type prompt for a phone number.
// whatsapp:send gated server-side; only rendered when the page allows it.
// ============================================================

export function ResendPromptButton() {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  function onSubmit() {
    setMsg(null);
    startTransition(async () => {
      const res = await resendCatalogPrompt({ phone });
      if (!res.success) {
        setMsg(res.error);
        return;
      }
      setMsg(res.data.sent ? "Prompt sent." : "Could not send — check WhatsApp config.");
      setPhone("");
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <SendIcon className="mr-2 size-4" />
          Resend prompt
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Resend catalog prompt</p>
          <p className="text-[11px] text-muted-foreground">
            Re-sends the event-type picker to a number. Only works inside their
            24h WhatsApp window.
          </p>
        </div>
        <Input
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
        <Button onClick={onSubmit} disabled={pending || phone.trim().length < 6} className="w-full">
          {pending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SendIcon className="mr-2 size-4" />
          )}
          Send prompt
        </Button>
        {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
      </PopoverContent>
    </Popover>
  );
}
