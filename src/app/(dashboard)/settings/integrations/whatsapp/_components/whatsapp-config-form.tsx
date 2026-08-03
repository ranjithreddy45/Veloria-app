"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveWhatsAppConfig,
  testWhatsAppConnectionAction,
  deleteWhatsAppConfig,
} from "@/actions/whatsapp-config.actions";

// ============================================================
// Types
// ============================================================

interface WhatsAppConfigData {
  id: string;
  provider: string;
  accessToken: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  appSecret: string | null;
  apiEndpoint: string | null;
  verifyToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppConfigFormProps {
  initialConfig: WhatsAppConfigData | null;
}

type Provider = "META" | "WATI";

// ============================================================
// Component
// ============================================================

export function WhatsAppConfigForm({ initialConfig }: WhatsAppConfigFormProps) {
  const [provider, setProvider] = useState<Provider>(
    (initialConfig?.provider as Provider) || "WATI"
  );
  const [accessToken, setAccessToken] = useState(initialConfig?.accessToken || "");
  const [phoneNumberId, setPhoneNumberId] = useState(
    initialConfig?.phoneNumberId || ""
  );
  const [businessAccountId, setBusinessAccountId] = useState(
    initialConfig?.businessAccountId || ""
  );
  const [appSecret, setAppSecret] = useState(initialConfig?.appSecret || "");
  const [apiEndpoint, setApiEndpoint] = useState(initialConfig?.apiEndpoint || "");
  const [verifyToken, setVerifyToken] = useState(
    initialConfig?.verifyToken || "veloria_whatsapp_verify"
  );
  const [connected, setConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [testingConnection, setTestingConnection] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.theveloriagrand.com";
  const webhookUrl =
    provider === "WATI"
      ? `${origin}/api/webhooks/wati?token=${encodeURIComponent(verifyToken)}`
      : `${origin}/api/webhooks/whatsapp`;

  const isWati = provider === "WATI";

  function handleSave() {
    startTransition(async () => {
      const result = await saveWhatsAppConfig({
        id: initialConfig?.id,
        provider,
        accessToken,
        phoneNumberId: phoneNumberId || undefined,
        businessAccountId: businessAccountId || undefined,
        appSecret: appSecret || undefined,
        apiEndpoint: apiEndpoint || undefined,
        verifyToken,
        isActive: true,
      });

      if (result.success) {
        toast.success("WhatsApp configuration saved successfully");
      } else {
        toast.error(result.error || "Failed to save configuration");
      }
    });
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    try {
      const result = await testWhatsAppConnectionAction();

      if (result.success && "data" in result) {
        setConnected(true);
        setConnectionInfo(result.data?.message || "Connected");
        toast.success(result.data?.message || "Connection successful");
      } else {
        setConnected(false);
        setConnectionInfo("");
        toast.error(
          ("error" in result && result.error) || "Connection test failed"
        );
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTestingConnection(false);
    }
  }

  function handleDelete() {
    if (!initialConfig?.id) return;

    startTransition(async () => {
      const result = await deleteWhatsAppConfig(initialConfig.id);
      if (result.success) {
        toast.success("WhatsApp configuration deleted");
        setAccessToken("");
        setPhoneNumberId("");
        setBusinessAccountId("");
        setAppSecret("");
        setApiEndpoint("");
        setVerifyToken("veloria_whatsapp_verify");
        setConnected(false);
        setConnectionInfo("");
      } else {
        toast.error(result.error || "Failed to delete configuration");
      }
    });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  const isConfigured = !!initialConfig?.id;
  const canSave = isWati
    ? !!(accessToken && apiEndpoint)
    : !!(accessToken && phoneNumberId && businessAccountId);

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                WhatsApp Business Configuration
              </CardTitle>
              <CardDescription>
                Connect a WhatsApp Business provider to send and receive messages.
                Everything in the app that uses WhatsApp routes through this.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isConfigured
                  ? "bg-success/15 text-success border-success/20"
                  : "bg-muted text-muted-foreground border-border"
              }
            >
              {isConfigured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WATI">WATI (wati.io)</SelectItem>
                <SelectItem value="META">Meta WhatsApp Cloud API</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isWati
                ? "Recommended — WATI manages the WhatsApp Business API for you. Get your endpoint + token from WATI → Account → API Docs."
                : "Direct Meta Cloud API — requires a Meta developer app, phone number ID and permanent token."}
            </p>
          </div>

          {/* Access Token (both providers) */}
          <div className="space-y-2">
            <Label htmlFor="waAccessToken">
              {isWati ? "WATI Access Token" : "Permanent Access Token"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="waAccessToken"
              type="password"
              placeholder={isWati ? "eyJhbGciOi... (Bearer token)" : "EAAxxxxxxx..."}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {isWati ? (
                <>Copy from WATI dashboard &rarr; Account &rarr; API Docs &rarr; Access Token.</>
              ) : (
                <>
                  Generate from Meta Business Settings &rarr; System Users with{" "}
                  <code>whatsapp_business_messaging</code> permission.
                </>
              )}
            </p>
          </div>

          {/* WATI-only: API endpoint */}
          {isWati && (
            <div className="space-y-2">
              <Label htmlFor="waApiEndpoint">
                WATI API Endpoint <span className="text-destructive">*</span>
              </Label>
              <Input
                id="waApiEndpoint"
                placeholder="https://live-mt-server.wati.io/10217207"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your tenant&rsquo;s API base URL, shown in WATI &rarr; Account &rarr; API Docs
                (e.g. <code>https://live-mt-server.wati.io/&lt;tenantId&gt;</code>).
              </p>
            </div>
          )}

          {/* Meta-only: phone number id + business account id + app secret */}
          {!isWati && (
            <>
              <div className="space-y-2">
                <Label htmlFor="waPhoneNumberId">
                  Phone Number ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="waPhoneNumberId"
                  placeholder="e.g. 123456789012345"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waBusinessAccountId">
                  Business Account ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="waBusinessAccountId"
                  placeholder="e.g. 123456789012345"
                  value={businessAccountId}
                  onChange={(e) => setBusinessAccountId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waAppSecret">App Secret</Label>
                <Input
                  id="waAppSecret"
                  type="password"
                  placeholder="Optional — for webhook signature verification"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Meta App Settings &rarr; Basic. Used to verify inbound webhook signatures.
                </p>
              </div>
            </>
          )}

          {/* Verify / webhook secret token (both) */}
          <div className="space-y-2">
            <Label htmlFor="waVerifyToken">
              {isWati ? "Webhook Secret Token" : "Webhook Verify Token"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="waVerifyToken"
                placeholder="veloria_whatsapp_verify"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copyToClipboard(verifyToken, "Token")}
                type="button"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isWati
                ? "A secret string of your choice. It's embedded in the webhook URL below so only WATI can post to your app."
                : "A custom string you also enter in the Meta Developer Console for webhook verification."}
            </p>
          </div>

          {/* Connection Status */}
          {connected && connectionInfo && (
            <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/10 p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <p className="text-sm text-success">{connectionInfo}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={isPending || !canSave}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !isConfigured}
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="mr-2 size-4" />
                  Test Connection
                </>
              )}
            </Button>
            {isConfigured && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                Remove Configuration
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Configuration</CardTitle>
          <CardDescription>
            {isWati
              ? "Add this URL in WATI → Settings → Webhooks so incoming messages and delivery statuses reach your inbox."
              : "Configure this URL in your Meta Developer Console to receive incoming messages and delivery status updates."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{isWati ? "Webhook URL (includes your secret token)" : "Callback URL"}</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                type="button"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          {!isWati && (
            <div className="space-y-2">
              <Label>Verify Token</Label>
              <div className="flex gap-2">
                <Input value={verifyToken} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(verifyToken, "Verify Token")}
                  type="button"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {isWati ? (
                <>
                  <strong>In WATI:</strong> Settings &rarr; Webhooks &rarr; Add. Paste the URL
                  above and enable the <code>Message received</code> and delivery-status events.
                </>
              ) : (
                <>
                  <strong>Subscribed Fields:</strong> Select <code>messages</code> in the Meta
                  Developer Console webhook settings.
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Guide</CardTitle>
          <CardDescription>
            {isWati
              ? "Connect WATI in a few minutes."
              : "Step-by-step instructions to set up Meta WhatsApp Cloud API."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isWati ? (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="w1">
                <AccordionTrigger className="text-sm">
                  Step 1: Get your API endpoint & access token
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    In WATI, open{" "}
                    <a
                      href="https://app.wati.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline inline-flex items-center gap-1"
                    >
                      Account &rarr; API Docs <ExternalLink className="size-3" />
                    </a>
                    . Copy the <strong>API Endpoint</strong> and the{" "}
                    <strong>Access Token</strong> into the fields above and Save.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="w2">
                <AccordionTrigger className="text-sm">
                  Step 2: Point WATI&rsquo;s webhook at this app
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    In WATI, go to <strong>Settings &rarr; Webhooks</strong>, add a webhook,
                    and paste the <strong>Webhook URL</strong> shown above (it already contains
                    your secret token). Enable the &ldquo;message received&rdquo; and delivery
                    status events.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="w3">
                <AccordionTrigger className="text-sm">
                  Step 3: Test & go
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Click <strong>Test Connection</strong> above. Once it&rsquo;s green, every
                    WhatsApp the app sends (OTP logins, lead replies, reminders, review requests)
                    goes through WATI, and customer replies land in your WhatsApp inbox.
                  </p>
                  <p>
                    Template messages must be pre-approved in WATI, and the app&rsquo;s template
                    names must match the ones you create in WATI.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="step-1">
                <AccordionTrigger className="text-sm">
                  Step 1: Create a Meta Developer App
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Go to{" "}
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline inline-flex items-center gap-1"
                    >
                      Meta Developer Console <ExternalLink className="size-3" />
                    </a>{" "}
                    and add the <strong>WhatsApp</strong> product.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step-2">
                <AccordionTrigger className="text-sm">
                  Step 2: Phone Number ID & Business Account ID
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    In <strong>WhatsApp &rarr; API Setup</strong>, copy the Phone Number ID and
                    the WhatsApp Business Account ID.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step-3">
                <AccordionTrigger className="text-sm">
                  Step 3: Permanent token + webhook
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Generate a permanent token (System Users), then set the Callback URL and
                    Verify Token above in <strong>WhatsApp &rarr; Configuration</strong> and
                    subscribe to <strong>messages</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/10 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-sm text-warning space-y-1">
              <p>
                <strong>Important:</strong> Free-text (session) messages only reach customers
                who messaged you in the last 24 hours. Outside that window you must send a
                pre-approved <strong>template</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
