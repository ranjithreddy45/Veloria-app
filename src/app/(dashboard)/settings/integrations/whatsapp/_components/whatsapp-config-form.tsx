"use client";

import { useState } from "react";
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
import { AlertCircle, CheckCircle2, Wifi } from "lucide-react";

// ============================================================
// WhatsApp Config Form (Placeholder)
// ============================================================

export function WhatsAppConfigForm() {
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);

  function handleSave() {
    // Placeholder — no real save, just show confirmation
    setSaved(true);
    setConnected(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTestConnection() {
    setTesting(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setConnected(true);
    setTesting(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              WhatsApp Business Configuration
            </CardTitle>
            <CardDescription>
              Connect your WhatsApp Business account to send messages and
              notifications.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              connected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-zinc-100 text-zinc-600 border-zinc-200"
            }
          >
            {connected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Placeholder Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This is a placeholder integration. Real WhatsApp Cloud API will be
            connected later.
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="waApiKey">API Key</Label>
          <Input
            id="waApiKey"
            type="password"
            placeholder="Enter your WhatsApp API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Phone Number ID */}
        <div className="space-y-2">
          <Label htmlFor="phoneNumberId">Phone Number ID</Label>
          <Input
            id="phoneNumberId"
            placeholder="Enter your WhatsApp Phone Number ID"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
        </div>

        {/* Business Account ID */}
        <div className="space-y-2">
          <Label htmlFor="businessAccountId">Business Account ID</Label>
          <Input
            id="businessAccountId"
            placeholder="Enter your WhatsApp Business Account ID"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!apiKey || !phoneNumberId || !businessAccountId}
          >
            Save Configuration
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
            <Wifi className="mr-2 size-4" />
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              Configuration saved (placeholder)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
