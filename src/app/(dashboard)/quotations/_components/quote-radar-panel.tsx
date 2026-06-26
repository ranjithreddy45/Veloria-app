"use client";

// ============================================================
// QuoteRadarPanel — mint a public /q/<token> share link for a quotation and
// watch the "radar": did the customer open it, how many times, on what device,
// and has it gone silent (opened but no view in 24h, unpaid) so the rep can
// nudge. The link IS the one-tap "Pay 20% to block your date" page.
// ------------------------------------------------------------
// Additive surface mounted on the quotation detail page. All actions are
// server actions (RBAC-gated there); this component only renders + refreshes.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Radar,
  Link2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Smartphone,
  Monitor,
  Tablet,
  Clock,
  Ban,
  Flame,
} from "lucide-react";

import {
  createQuoteShareLink,
  revokeQuoteShareLink,
  type QuoteRadarSignals,
} from "@/actions/quote-share.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  quotationId: string;
  initial: QuoteRadarSignals | null;
  /** Gate the mint/revoke buttons (rep can share/send). */
  canShare: boolean;
}

function deviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d.includes("mobile") || d.includes("phone")) return <Smartphone className="size-3.5" />;
  if (d.includes("tablet")) return <Tablet className="size-3.5" />;
  return <Monitor className="size-3.5" />;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function QuoteRadarPanel({ quotationId, initial, canShare }: Props) {
  const router = useRouter();
  const [signals, setSignals] = useState<QuoteRadarSignals | null>(initial);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = signals && signals.status === "ACTIVE" ? signals : null;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCreate() {
    startTransition(async () => {
      const res = await createQuoteShareLink(quotationId, { ensureProforma: true });
      if (!res.success) {
        toast.error(res.error || "Could not create the share link.");
        return;
      }
      // Optimistic minimal signal; router.refresh() repopulates radar stats.
      setSignals({
        id: res.data.id,
        token: res.data.token,
        url: res.data.url,
        status: "ACTIVE",
        quotationId,
        opened: false,
        viewCount: 0,
        uniqueViewers: 0,
        firstViewedAt: null,
        lastViewedAt: null,
        silentNudgeFiredAt: null,
        openedButSilent: false,
        payInvoiceId: res.data.payInvoiceId,
        paymentLinkUrl: null,
        aiCaption: null,
        deviceMix: [],
        recentViews: [],
      });
      toast.success("Share link ready — send it to your customer.");
      refresh();
    });
  }

  async function handleRevoke() {
    if (!link) return;
    startTransition(async () => {
      const res = await revokeQuoteShareLink(link.id);
      if (!res.success) {
        toast.error(res.error || "Could not revoke the link.");
        return;
      }
      setSignals(signals ? { ...signals, status: "REVOKED" } : null);
      toast.success("Link revoked — it no longer opens publicly.");
      refresh();
    });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard?.writeText(link.url).then(
      () => {
        setCopied(true);
        toast.success("Link copied");
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error("Couldn't copy — select the link manually.")
    );
  }

  function whatsappHref(): string {
    if (!link) return "#";
    const caption = link.aiCaption ? `${link.aiCaption}\n${link.url}` : link.url;
    return `https://wa.me/?text=${encodeURIComponent(caption)}`;
  }

  return (
    <Card className="border-violet-200/70 dark:border-violet-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4 text-violet-600" />
          Quote radar
          {link?.openedButSilent && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Flame className="mr-1 size-3" /> Opened, gone quiet
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {signals?.status === "REVOKED"
                ? "The previous share link was revoked. Create a fresh one to share this quote again."
                : "Share a one-tap “Pay 20% to block your date” link. You'll see when the customer opens it, how often, and if it goes quiet."}
            </p>
            {canShare ? (
              <Button onClick={handleCreate} disabled={pending} className="gap-2">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Create share link
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">You don't have permission to share this quote.</p>
            )}
          </div>
        ) : (
          <>
            {/* Public link + share actions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <Link2 className="size-4 shrink-0 text-violet-600" />
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{link.url}</span>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2" onClick={copyLink}>
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-3.5 text-green-600" /> Share on WhatsApp
                  </a>
                </Button>
                {canShare && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleRevoke} disabled={pending}>
                    <Ban className="size-3.5" /> Revoke
                  </Button>
                )}
              </div>
            </div>

            {/* Radar stats */}
            <div className="grid grid-cols-3 gap-2">
              <Stat
                icon={link.opened ? <Eye className="size-4 text-emerald-600" /> : <EyeOff className="size-4 text-muted-foreground" />}
                label={link.opened ? "Opened" : "Not opened yet"}
                value={link.opened ? timeAgo(link.firstViewedAt) : "—"}
              />
              <Stat icon={<Eye className="size-4 text-violet-600" />} label="Views" value={String(link.viewCount)} />
              <Stat icon={<Clock className="size-4 text-blue-600" />} label="Last seen" value={timeAgo(link.lastViewedAt)} />
            </div>

            {link.uniqueViewers > 0 && (
              <p className="text-xs text-muted-foreground">
                {link.uniqueViewers} unique viewer{link.uniqueViewers === 1 ? "" : "s"}
                {link.deviceMix.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-2">
                    {link.deviceMix.map((d) => (
                      <span key={d.device} className="inline-flex items-center gap-1">
                        {deviceIcon(d.device)} {d.count}
                      </span>
                    ))}
                  </span>
                )}
              </p>
            )}

            {link.recentViews.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-2.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent opens</p>
                <ul className="space-y-1">
                  {link.recentViews.slice(0, 5).map((v, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      {deviceIcon(v.device)}
                      <span className="capitalize">{v.device.toLowerCase()}</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span>{timeAgo(v.viewedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2 text-center">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
