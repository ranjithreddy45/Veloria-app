"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Wifi, WifiOff, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { upsertLeadCaptureConfig, testLeadCaptureConfig } from "@/actions/lead-capture-config.actions";

interface Props {
  initialConfig?: {
    credentials: Record<string, string>;
    isActive: boolean;
    lastSyncAt?: string | Date | null;
  } | null;
}

export function GoogleConfig({ initialConfig }: Props) {
  const creds = initialConfig?.credentials || {};
  const [webhookToken, setWebhookToken] = useState(creds.webhookToken || "veloria_google_verify");
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isConnected = initialConfig?.isActive && !!creds.webhookToken;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.theveloriagrand.com";
  const webhookUrl = `${baseUrl}/api/webhooks/google-ads`;

  function handleSave() {
    startTransition(async () => {
      const result = await upsertLeadCaptureConfig({
        platform: "GOOGLE",
        credentials: { webhookToken },
        isActive: true,
      });

      if (result.success) {
        toast.success("Google Ads configuration saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await testLeadCaptureConfig("GOOGLE");
      if (result.success) {
        toast.success(result.data?.message || "Configuration valid");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsTesting(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Google Ads</CardTitle>
            <CardDescription>
              Capture leads from Google Ads Lead Form extensions.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              isConnected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-zinc-100 text-zinc-500 border-zinc-200"
            }
          >
            {isConnected ? (
              <><Wifi className="mr-1 h-3 w-3" /> Connected</>
            ) : (
              <><WifiOff className="mr-1 h-3 w-3" /> Not Connected</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label>Webhook URL</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="bg-muted font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Webhook Token */}
        <div className="space-y-1.5">
          <Label>Webhook Authorization Token</Label>
          <Input
            value={webhookToken}
            onChange={(e) => setWebhookToken(e.target.value)}
            placeholder="veloria_google_verify"
          />
          <p className="text-xs text-muted-foreground">
            This token is sent as a Bearer token in the Authorization header from Google.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Test
          </Button>
        </div>

        {initialConfig?.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last lead received: {new Date(initialConfig.lastSyncAt).toLocaleString()}
          </p>
        )}

        {/* Setup Guide */}
        <div className="border-t pt-4">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Setup Guide
          </button>
          {showGuide && (
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>In <strong>Google Ads</strong>, create or edit a Lead Form Extension</li>
              <li>Under <strong>Webhook integration</strong>, paste the Webhook URL above</li>
              <li>Set the <strong>Authorization header</strong> to: <code>Bearer {webhookToken}</code></li>
              <li>Configure your lead form fields (Name, Email, Phone Number)</li>
              <li>Submit a test lead from Google Ads to verify the integration</li>
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
