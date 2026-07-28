"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Webhook } from "lucide-react";
import { toast } from "sonner";
import { FacebookConfig } from "./facebook-config";
import { GoogleConfig } from "./google-config";
import { ApiKeyManager } from "./api-key-manager";

interface LeadCaptureConfigItem {
  id: string;
  platform: string;
  credentials: Record<string, string>;
  isActive: boolean;
  lastSyncAt?: string | Date | null;
}

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
}

interface Props {
  baseUrl: string;
  configs: LeadCaptureConfigItem[];
  apiKeys: ApiKeyItem[];
}

export function LeadCaptureConfig({ baseUrl, configs, apiKeys }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fbConfig = configs.find((c) => c.platform === "FACEBOOK") || null;
  const googleConfig = configs.find((c) => c.platform === "GOOGLE") || null;

  const webhookUrls = [
    {
      name: "Facebook Lead Ads",
      url: `${baseUrl}/api/webhooks/facebook-leads`,
      description: "Paste into your Facebook Lead Ads webhook configuration.",
      badge: "Facebook",
      hue: "blue" as Hue,
    },
    {
      name: "Google Ads",
      url: `${baseUrl}/api/webhooks/google-ads`,
      description: "Paste into your Google Ads lead form extension.",
      badge: "Google",
      hue: "red" as Hue,
    },
    {
      name: "Generic Lead Capture API",
      url: `${baseUrl}/api/leads/capture`,
      description:
        "Universal endpoint for IndiaMart, JustDial, Sulekha, 99Acres or any custom integration. Requires an x-api-key header.",
      badge: "Universal",
      hue: "violet" as Hue,
    },
  ];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Tabs defaultValue="facebook" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="facebook">Facebook</TabsTrigger>
        <TabsTrigger value="google">Google Ads</TabsTrigger>
        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
      </TabsList>

      {/* Facebook Tab */}
      <TabsContent value="facebook">
        <FacebookConfig
          initialConfig={
            fbConfig
              ? {
                  credentials: fbConfig.credentials,
                  isActive: fbConfig.isActive,
                  lastSyncAt: fbConfig.lastSyncAt,
                }
              : null
          }
        />
      </TabsContent>

      {/* Google Ads Tab */}
      <TabsContent value="google">
        <GoogleConfig
          initialConfig={
            googleConfig
              ? {
                  credentials: googleConfig.credentials,
                  isActive: googleConfig.isActive,
                  lastSyncAt: googleConfig.lastSyncAt,
                }
              : null
          }
        />
      </TabsContent>

      {/* API Keys Tab */}
      <TabsContent value="api-keys">
        <ApiKeyManager initialKeys={apiKeys} />
      </TabsContent>

      {/* Webhooks Tab */}
      <TabsContent value="webhooks">
        <section className="rounded-2xl border bg-card shadow-card">
          <div className="border-b px-5 py-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
              <Webhook className="size-4 text-muted-foreground" />
              Webhook URLs
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Copy each URL into the matching platform&apos;s settings — leads
              posted here land in your pipeline instantly.
            </p>
          </div>
          <div className="divide-y">
            {webhookUrls.map((webhook) => (
              <div key={webhook.name} className="space-y-2.5 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium">{webhook.name}</h4>
                  <StatusPill label={webhook.badge} hue={webhook.hue} size="xs" />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {webhook.description}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhook.url}
                    className="numeric bg-muted/40 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(webhook.url, webhook.name)}
                    title={`Copy ${webhook.name} URL`}
                  >
                    {copiedField === webhook.name ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}
