"use client";

import * as React from "react";
import { toast } from "sonner";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { generateHostInvite } from "@/actions/host-portal-invite.actions";

export function HostInviteButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  function invite() {
    startTransition(async () => {
      const res = await generateHostInvite(contactId);
      if (res.success) { setUrl(res.data.url); setEmail(res.data.email); setOpen(true); }
      else toast.error(res.error);
    });
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Couldn't copy — select the link and copy it manually."); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={invite} disabled={pending} className="gap-1.5">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Invite to portal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer portal invite</DialogTitle>
            <DialogDescription>
              Share this single-use link with <strong>{email}</strong>. They&apos;ll set a password and get access to
              their bookings, invoices, guest list, and documents. The link expires in 14 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button size="icon" variant="outline" onClick={copy} className="shrink-0">
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">No email is sent automatically — send this link via WhatsApp or email.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
