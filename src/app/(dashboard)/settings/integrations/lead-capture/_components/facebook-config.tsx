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

export function FacebookConfig({ initialConfig }: Props) {
  const creds = initialConfig?.credentials || {};
  const [appId, setAppId] = useState(creds.appId || "");
  const [accessToken, setAccessToken] = useState(creds.accessToken || "");
  const [verifyToken, setVerifyToken] = useState(creds.verifyToken || "veloria_fb_verify");
  const [pageId, setPageId] = useState(creds.pageId || "");
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isConnected = initialConfig?.isActive && !!creds.accessToken;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.theveloriagrand.com";
  const webhookUrl = `${baseUrl}/api/webhooks/facebook-leads`;

  function handleSave() {
    startTransition(async () => {
      const result = await upsertLeadCaptureConfig({
        platform: "FACEBOOK",
        credentials: { appId, accessToken, verifyToken, pageId },
        isActive: true,
      });

      if (result.success) {
        toast.success("Facebook Lead Ads configuration saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await testLeadCaptureConfig("FACEBOOK");
      if (result.success) {
        toast.success(result.data?.message || "Connected successfully");
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
            <CardTitle className="text-lg">Facebook Lead Ads</CardTitle>
            <CardDescription>
              Automatically capture leads from your Facebook & Instagram ad campaigns.
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

        {/* Credentials */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Facebook App ID</Label>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. 123456789012345"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Page ID</Label>
            <Input
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="e.g. 987654321098765"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Page Access Token</Label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxx..."
          />
          <p className="text-xs text-muted-foreground">
            Generate a long-lived Page Access Token from the Facebook Developer portal.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Verify Token</Label>
          <Input
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder="veloria_fb_verify"
          />
          <p className="text-xs text-muted-foreground">
            Use this token when subscribing to webhooks in Meta Developer Dashboard.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting || !accessToken}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Test Connection
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
              <li>Go to <strong>Meta Developer Dashboard</strong> → Your App → Webhooks</li>
              <li>Click <strong>&quot;Subscribe to this object&quot;</strong> for <code>Page</code></li>
              <li>Paste the <strong>Webhook URL</strong> above and the <strong>Verify Token</strong></li>
              <li>Subscribe to the <strong>&quot;leadgen&quot;</strong> field</li>
              <li>Go to <strong>Page Settings → Connected Apps</strong> and ensure your app has the <code>leads_retrieval</code> permission</li>
              <li>Generate a <strong>long-lived Page Access Token</strong> with <code>pages_manage_ads</code>, <code>ads_management</code>, <code>leads_retrieval</code> permissions</li>
              <li>Paste the token above and click <strong>Save</strong></li>
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
