"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      description: "Use this URL in your Facebook Lead Ads webhook configuration",
      badge: "Facebook",
      badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    },
    {
      name: "Google Ads",
      url: `${baseUrl}/api/webhooks/google-ads`,
      description: "Use this URL for Google Ads lead form extensions",
      badge: "Google",
      badgeColor: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    },
    {
      name: "Generic Lead Capture API",
      url: `${baseUrl}/api/leads/capture`,
      description:
        "Universal API for IndiaMart, JustDial, Sulekha, 99Acres, or any custom integration. Requires x-api-key header.",
      badge: "Universal",
      badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
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
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook URLs
            </CardTitle>
            <CardDescription>
              Copy these URLs and configure them in your ad platform settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhookUrls.map((webhook) => (
              <div
                key={webhook.name}
                className="border border-border/50 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{webhook.name}</h4>
                    <Badge variant="outline" className={webhook.badgeColor}>
                      {webhook.badge}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{webhook.description}</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhook.url}
                    className="font-mono text-xs bg-muted/30"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(webhook.url, webhook.name)}
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
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
