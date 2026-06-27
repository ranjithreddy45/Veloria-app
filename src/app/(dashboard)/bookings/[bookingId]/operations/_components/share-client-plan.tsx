"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureClientToken } from "@/actions/public-event-plan.actions";

// Lets a rep mint/share the public client event-plan link (/event/<token>). For
// provisioned bookings the token already exists (returns instantly); older ones
// get one minted on first click.
export function ShareClientPlan({ bookingId }: { bookingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function getLink() {
    setBusy(true);
    try {
      const res = await ensureClientToken(bookingId);
      if (!res.success) {
        toast.error(res.error || "Couldn't create the client link.");
        return;
      }
      setUrl(res.data.url);
      navigator.clipboard?.writeText(res.data.url).then(
        () => { setCopied(true); toast.success("Client event-plan link copied"); setTimeout(() => setCopied(false), 1800); },
        () => toast.message("Client link ready", { description: res.data.url })
      );
    } finally {
      setBusy(false);
    }
  }

  if (!url) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={getLink} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
        Share client plan
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
        navigator.clipboard?.writeText(url).then(() => { setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1800); });
      }}>
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy client link"}
      </Button>
      <Button asChild variant="ghost" size="icon" className="size-8" title="Open client plan">
        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /></a>
      </Button>
    </div>
  );
}
