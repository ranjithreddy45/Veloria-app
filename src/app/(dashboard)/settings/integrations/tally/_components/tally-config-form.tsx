"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function TallyConfigForm() {
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // Placeholder — no real save, just show confirmation
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tally Configuration</CardTitle>
        <CardDescription>
          Connect your Tally account for automatic accounting sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Placeholder Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This is a placeholder integration. Real Tally API will be connected
            later.
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Enter your Tally API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Company ID */}
        <div className="space-y-2">
          <Label htmlFor="companyId">Company ID</Label>
          <Input
            id="companyId"
            placeholder="Enter your Tally Company ID"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
        </div>

        {/* Auto-Sync Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="autoSync" className="text-sm font-medium">
              Auto-Sync
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically sync invoices, payments, and payouts to Tally.
            </p>
          </div>
          <Switch
            id="autoSync"
            checked={autoSync}
            onCheckedChange={setAutoSync}
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!apiKey || !companyId}>
            Save Configuration
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Configuration saved (placeholder)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
