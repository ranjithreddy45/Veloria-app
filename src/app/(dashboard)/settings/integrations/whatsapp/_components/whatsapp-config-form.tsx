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
  accessToken: string | null;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret: string | null;
  verifyToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppConfigFormProps {
  initialConfig: WhatsAppConfigData | null;
}

// ============================================================
// Component
// ============================================================

export function WhatsAppConfigForm({ initialConfig }: WhatsAppConfigFormProps) {
  const [accessToken, setAccessToken] = useState(
    initialConfig?.accessToken || ""
  );
  const [phoneNumberId, setPhoneNumberId] = useState(
    initialConfig?.phoneNumberId || ""
  );
  const [businessAccountId, setBusinessAccountId] = useState(
    initialConfig?.businessAccountId || ""
  );
  const [appSecret, setAppSecret] = useState(initialConfig?.appSecret || "");
  const [verifyToken, setVerifyToken] = useState(
    initialConfig?.verifyToken || "veloria_whatsapp_verify"
  );
  const [connected, setConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [testingConnection, setTestingConnection] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/whatsapp`
      : "/api/webhooks/whatsapp";

  function handleSave() {
    startTransition(async () => {
      const result = await saveWhatsAppConfig({
        id: initialConfig?.id,
        accessToken,
        phoneNumberId,
        businessAccountId,
        appSecret: appSecret || undefined,
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
                Connect your Meta WhatsApp Business account to send messages and
                notifications via WhatsApp Cloud API.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isConfigured
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }
            >
              {isConfigured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Access Token */}
          <div className="space-y-2">
            <Label htmlFor="waAccessToken">
              Permanent Access Token <span className="text-destructive">*</span>
            </Label>
            <Input
              id="waAccessToken"
              type="password"
              placeholder="EAAxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Generate from Meta Business Settings &rarr; System Users &rarr;
              Generate Token with <code>whatsapp_business_messaging</code>{" "}
              permission.
            </p>
          </div>

          {/* Phone Number ID */}
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
            <p className="text-xs text-muted-foreground">
              Found in Meta Developer Console &rarr; WhatsApp &rarr; API Setup.
            </p>
          </div>

          {/* Business Account ID */}
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
            <p className="text-xs text-muted-foreground">
              Found in Meta Business Settings &rarr; Business Info.
            </p>
          </div>

          {/* App Secret */}
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
              Found in Meta Developer Console &rarr; App Settings &rarr; Basic.
              Required for secure webhook verification.
            </p>
          </div>

          {/* Verify Token */}
          <div className="space-y-2">
            <Label htmlFor="waVerifyToken">
              Webhook Verify Token <span className="text-destructive">*</span>
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
                onClick={() => copyToClipboard(verifyToken, "Verify Token")}
                type="button"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A custom string you set in Meta Developer Console for webhook
              verification.
            </p>
          </div>

          {/* Connection Status */}
          {connected && connectionInfo && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {connectionInfo}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={
                isPending || !accessToken || !phoneNumberId || !businessAccountId
              }
            >
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
            Configure this URL in your Meta Developer Console to receive incoming
            messages and delivery status updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Callback URL</Label>
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

          <div className="space-y-2">
            <Label>Verify Token</Label>
            <div className="flex gap-2">
              <Input
                value={verifyToken}
                readOnly
                className="font-mono text-sm"
              />
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

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Subscribed Fields:</strong> Select{" "}
              <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">
                messages
              </code>{" "}
              in the Meta Developer Console webhook settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Guide</CardTitle>
          <CardDescription>
            Step-by-step instructions to set up WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    Meta Developer Console
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  and create a new Business app.
                </p>
                <p>
                  Add the <strong>WhatsApp</strong> product to your app from the
                  App Dashboard.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-2">
              <AccordionTrigger className="text-sm">
                Step 2: Get your Phone Number ID & Business Account ID
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  In the Meta Developer Console, go to <strong>WhatsApp &rarr; API Setup</strong>.
                </p>
                <p>
                  Copy the <strong>Phone Number ID</strong> shown on that page.
                </p>
                <p>
                  The <strong>WhatsApp Business Account ID</strong> is shown at the top of the same page.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-3">
              <AccordionTrigger className="text-sm">
                Step 3: Generate a Permanent Access Token
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Go to{" "}
                  <a
                    href="https://business.facebook.com/settings/system-users"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Meta Business Settings &rarr; System Users
                    <ExternalLink className="size-3" />
                  </a>
                </p>
                <p>
                  Create a system user (or use an existing one), assign it the WhatsApp
                  Business account as an asset, and generate a token with the{" "}
                  <code className="rounded bg-muted px-1">
                    whatsapp_business_messaging
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-muted px-1">
                    whatsapp_business_management
                  </code>{" "}
                  permissions.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-4">
              <AccordionTrigger className="text-sm">
                Step 4: Configure Webhook
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  In the Meta Developer Console, go to{" "}
                  <strong>WhatsApp &rarr; Configuration</strong>.
                </p>
                <p>
                  Set the <strong>Callback URL</strong> to the webhook URL shown
                  above.
                </p>
                <p>
                  Set the <strong>Verify Token</strong> to match the verify token
                  above.
                </p>
                <p>
                  Subscribe to <strong>messages</strong> webhook field.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-5">
              <AccordionTrigger className="text-sm">
                Step 5: Get App Secret (Optional but Recommended)
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Go to <strong>App Settings &rarr; Basic</strong> in the Meta
                  Developer Console.
                </p>
                <p>
                  Copy the <strong>App Secret</strong> — this is used to verify
                  webhook signatures (HMAC-SHA256) for security.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Important Notes */}
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <p>
                <strong>Important:</strong> The test phone number from Meta
                allows sending to up to 5 verified numbers. For production, you
                need to register and verify a real business phone number.
              </p>
              <p>
                Template messages must be pre-approved by Meta before they can be
                sent. Create them in WhatsApp Manager &rarr; Message Templates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
