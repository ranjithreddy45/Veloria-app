"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveGadsValueMap, regenerateGadsApiKey } from "@/actions/gads-config.actions";

interface Bucket {
  key: string;
  label: string;
  value: number;
}

export function GadsSettingsForm({
  buckets,
  hasApiKey,
  apiKeyMasked,
}: {
  buckets: Bucket[];
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(
    Object.fromEntries(buckets.map((b) => [b.key, String(b.value)]))
  );
  const [savingMap, setSavingMap] = React.useState(false);
  const [genKey, setGenKey] = React.useState(false);
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.theveloriagrand.com";
  const getUrl = `${origin}/api/v1/marketing/offline-conversions?conversion=qualified_lead&status=ready`;
  const ackUrl = `${origin}/api/v1/marketing/offline-conversions/ack`;

  async function handleSaveMap() {
    setSavingMap(true);
    try {
      const map: Record<string, number> = {};
      for (const b of buckets) map[b.key] = Number(values[b.key]) || 0;
      const res = await saveGadsValueMap(map);
      if (res.success) toast.success("Value map saved");
      else toast.error(res.error);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingMap(false);
    }
  }

  async function handleGenerateKey() {
    setGenKey(true);
    try {
      const res = await regenerateGadsApiKey();
      if (res.success) {
        setRevealedKey(res.apiKey);
        toast.success("New API key generated — copy it now, it won't be shown again.");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to generate key");
    } finally {
      setGenKey(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="space-y-6">
      {/* Value map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Value per qualified lead</CardTitle>
          <CardDescription>
            Tells Google a wedding lead is worth several birthday leads. Sent as the{" "}
            <code>conversion_value</code> for the Qualified-Lead conversion. Bookings use the
            actual booking value instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {buckets.map((b) => (
              <div key={b.key} className="space-y-1.5">
                <Label htmlFor={`v-${b.key}`}>{b.label}</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id={`v-${b.key}`}
                    inputMode="numeric"
                    className="pl-8"
                    value={values[b.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [b.key]: e.target.value.replace(/[^\d]/g, "") }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleSaveMap} disabled={savingMap}>
            {savingMap && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save value map
          </Button>
        </CardContent>
      </Card>

      {/* API key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Offline-conversion API key</CardTitle>
          <CardDescription>
            The uploader authenticates every pull with this key as{" "}
            <code>Authorization: Bearer &lt;key&gt;</code>. Generate one, hand it to whoever runs
            the weekly upload, and rotate it any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {revealedKey ? (
            <div className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
              <Label className="text-amber-800 dark:text-amber-300">
                New key — copy it now, it won&rsquo;t be shown again
              </Label>
              <div className="flex gap-2">
                <Input value={revealedKey} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => copy(revealedKey, "API key")}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {hasApiKey ? (
                <>
                  A key is set (<code>{apiKeyMasked}</code>). Generate a new one to rotate it.
                </>
              ) : (
                <>No key yet — generate one to enable the offline-conversion API.</>
              )}
            </p>
          )}
          <Button variant="outline" onClick={handleGenerateKey} disabled={genKey}>
            {genKey ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
            {hasApiKey ? "Generate new key" : "Generate key"}
          </Button>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoints (for the uploader)</CardTitle>
          <CardDescription>
            Pull READY conversions, upload to Google, then acknowledge so nothing uploads twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pull qualified leads / bookings (GET)</Label>
            <div className="flex gap-2">
              <Input value={getUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(getUrl, "URL")}>
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Swap <code>conversion=qualified_lead</code> for <code>conversion=booking</code> to
              pull confirmed bookings.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Acknowledge upload (POST)</Label>
            <div className="flex gap-2">
              <Input value={ackUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(ackUrl, "URL")}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
