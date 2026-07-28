"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Wifi, WifiOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { saveTelephonyConfig, testTelephonyConnection } from "@/actions/telephony.actions";

interface TelephonyConfigData {
  id: string;
  provider: string;
  apiKey: string | null;
  apiSecret: string | null;
  callerId: string;
  accountSid: string | null;
  subdomain: string | null;
  webhookSecret: string | null;
  isActive: boolean;
}

interface Props {
  initialConfig: TelephonyConfigData | null | undefined;
}

export function TelephonyConfigForm({ initialConfig }: Props) {
  const [provider, setProvider] = useState(initialConfig?.provider || "");
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || "");
  const [apiSecret, setApiSecret] = useState(initialConfig?.apiSecret || "");
  const [callerId, setCallerId] = useState(initialConfig?.callerId || "");
  const [accountSid, setAccountSid] = useState(initialConfig?.accountSid || "");
  const [subdomain, setSubdomain] = useState(initialConfig?.subdomain || "");
  const [webhookSecret, setWebhookSecret] = useState(initialConfig?.webhookSecret || "");
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = !!initialConfig?.isActive;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.theveloriagrand.com";
  const webhookUrl = provider ? `${baseUrl}/api/webhooks/telephony?provider=${provider.toLowerCase()}` : "";

  function handleSave() {
    startTransition(async () => {
      const result = await saveTelephonyConfig({
        id: initialConfig?.id,
        provider: provider as any,
        apiKey,
        apiSecret,
        callerId,
        accountSid,
        subdomain,
        webhookSecret,
        isActive: true,
      });

      if (result.success) {
        toast.success("Telephony configuration saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await testTelephonyConnection();
      if (result.success) {
        toast.success(result.data?.message || "Connection test passed");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsTesting(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Provider Configuration</CardTitle>
              <CardDescription>
                Connect Exotel, Knowlarity, or MyOperator for click-to-call and call recording.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "bg-success/15 text-success border-success/20"
                  : "bg-muted text-muted-foreground border-border"
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
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <Label>Telephony Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXOTEL">Exotel</SelectItem>
                <SelectItem value="KNOWLARITY">Knowlarity</SelectItem>
                <SelectItem value="MYOPERATOR">MyOperator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider && (
            <>
              {/* Common: API Key */}
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === "EXOTEL" ? "Exotel API Key" :
                    provider === "KNOWLARITY" ? "Knowlarity API Key" :
                    "MyOperator API Key"
                  }
                />
              </div>

              {/* Exotel: API Token (Secret) */}
              {provider === "EXOTEL" && (
                <>
                  <div className="space-y-1.5">
                    <Label>API Token</Label>
                    <Input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Exotel API Token"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account SID</Label>
                    <Input
                      value={accountSid}
                      onChange={(e) => setAccountSid(e.target.value)}
                      placeholder="e.g. veloriagrand1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subdomain</Label>
                    <Input
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="e.g. api.exotel.com"
                    />
                  </div>
                </>
              )}

              {/* MyOperator: Company ID */}
              {provider === "MYOPERATOR" && (
                <div className="space-y-1.5">
                  <Label>Company ID</Label>
                  <Input
                    value={accountSid}
                    onChange={(e) => setAccountSid(e.target.value)}
                    placeholder="MyOperator Company ID"
                  />
                </div>
              )}

              {/* Caller ID / Virtual Number */}
              <div className="space-y-1.5">
                <Label>
                  {provider === "KNOWLARITY" ? "SR Number (Caller ID)" : "Caller ID / Virtual Number"}
                </Label>
                <Input
                  value={callerId}
                  onChange={(e) => setCallerId(e.target.value)}
                  placeholder="e.g. +91 80XXXXXXXX"
                />
              </div>

              {/* Webhook URL */}
              {webhookUrl && (
                <div className="space-y-1.5">
                  <Label>Webhook URL (for call status & recording updates)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="bg-muted font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyWebhookUrl}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure this URL in your {provider === "EXOTEL" ? "Exotel" : provider === "KNOWLARITY" ? "Knowlarity" : "MyOperator"} dashboard to receive call recordings.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={isPending || !apiKey || !callerId}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Configuration
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={isTesting || !isConnected}>
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                  Test Connection
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
