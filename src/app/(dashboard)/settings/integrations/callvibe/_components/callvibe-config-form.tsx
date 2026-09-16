"use client";

// ============================================================
// CallVibe settings.
// ------------------------------------------------------------
// "Test connection" does more than prove the password: CallVibe publishes no
// response schema for GET /calls, so the test reports the field names of a real
// call and what this app read out of them. That is the check that the import is
// mapping the right fields — a green tick alone would not tell anyone.
// ============================================================

import { useState, useTransition } from "react";
import { Loader2, Save, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  saveCallVibeConfig,
  syncCallVibeNow,
  testCallVibeConnection,
} from "@/actions/callvibe.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface CallVibeConfigData {
  id: string;
  baseUrl: string;
  email: string;
  password: string;
  tenantId: string | null;
  pushToken: string | null;
  syncEnabled: boolean;
  syncWindowHours: number;
  isActive: boolean;
  lastSyncAt: Date | null;
  lastCallAt: Date | null;
  lastSyncNote: string | null;
}

interface Props {
  initialConfig: CallVibeConfigData | null | undefined;
}

interface TestReport {
  tenantId: string | null;
  callsSeen: number;
  sampleKeys: string[];
  sample: {
    id: string;
    phone: string | null;
    agent: string | null;
    direction: string;
    answered: boolean;
    durationSeconds: number;
    startedAt: string;
    hasRecording: boolean;
    hasTranscript: boolean;
    sentiment: string | null;
  } | null;
}

export function CallVibeConfigForm({ initialConfig }: Props) {
  const [email, setEmail] = useState(initialConfig?.email ?? "");
  const [password, setPassword] = useState(initialConfig?.password ?? "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "https://api.callvibe.ai");
  const [tenantId, setTenantId] = useState(initialConfig?.tenantId ?? "");
  const [syncEnabled, setSyncEnabled] = useState(initialConfig?.syncEnabled ?? true);
  const [syncWindowHours, setSyncWindowHours] = useState(
    String(initialConfig?.syncWindowHours ?? 24)
  );

  const [isPending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<TestReport | null>(null);

  const connected = Boolean(initialConfig?.isActive);

  function handleSave() {
    startTransition(async () => {
      const result = await saveCallVibeConfig({
        id: initialConfig?.id,
        baseUrl,
        email,
        password,
        tenantId,
        pushToken: "",
        syncEnabled,
        syncWindowHours: Number(syncWindowHours) || 24,
        isActive: true,
      });
      if (result.success) toast.success("CallVibe settings saved");
      else toast.error(result.error);
    });
  }

  async function handleTest() {
    setTesting(true);
    setReport(null);
    try {
      const result = await testCallVibeConnection();
      if (result.success && result.data) {
        setReport(result.data);
        if (result.data.tenantId) setTenantId(result.data.tenantId);
        toast.success(
          result.data.sample
            ? "Connected to CallVibe and read a call"
            : "Connected to CallVibe. No calls in the account yet."
        );
      } else {
        toast.error(result.error ?? "CallVibe did not accept the credentials");
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncCallVibeNow(Number(syncWindowHours) || 24);
      if (result.success && result.data) {
        toast.success(
          `Imported ${result.data.imported}, already had ${result.data.deduped}, new leads ${result.data.rescued}`
        );
      } else {
        toast.error(("error" in result && result.error) || "The sync reported errors");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>CallVibe account</CardTitle>
              <CardDescription>
                CallVibe issues no API key. The import signs in with an account, so use a dedicated
                CallVibe user rather than a person&apos;s own login.
              </CardDescription>
            </div>
            <Badge variant={connected ? "default" : "secondary"} className="shrink-0">
              {connected ? (
                <>
                  <Wifi className="mr-1 size-3" /> Connected
                </>
              ) : (
                <>
                  <WifiOff className="mr-1 size-3" /> Not connected
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Account email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="integrations@theveloriagrand.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="CallVibe account password"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API address</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tenant ID</Label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Filled in automatically when you test the connection"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !initialConfig}>
              {testing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Wifi className="mr-2 size-4" />
              )}
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call import</CardTitle>
          <CardDescription>
            CallVibe cannot send calls to us, so the app reads them on the hourly job. Imported
            calls appear on the contact timeline and in the CRM calls list, with the transcript and
            summary attached. An inbound call from an unknown number becomes a lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Import calls automatically</p>
              <p className="text-muted-foreground text-sm">Runs every hour with the other jobs.</p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>How far back to look on a first run (hours)</Label>
              <Input
                type="number"
                min={1}
                max={720}
                value={syncWindowHours}
                onChange={(e) => setSyncWindowHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last run</Label>
              <p className="text-muted-foreground pt-2 text-sm">
                {initialConfig?.lastSyncAt
                  ? `${new Date(initialConfig.lastSyncAt).toLocaleString()} — ${
                      initialConfig.lastSyncNote ?? "no detail"
                    }`
                  : "Not run yet"}
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={handleSyncNow} disabled={syncing || !initialConfig}>
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Import calls now
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>What CallVibe returned</CardTitle>
            <CardDescription>
              CallVibe does not publish the shape of a call record, so this shows the fields of a
              real call next to what the import read from them. If a value below is blank but the
              call has it in CallVibe, the field name needs adding to the mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Tenant:</span> {report.tenantId ?? "unknown"}
            </p>
            {report.sample ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  {report.sample.phone ?? "not read"}
                </p>
                <p>
                  <span className="text-muted-foreground">Agent:</span>{" "}
                  {report.sample.agent ?? "not read"}
                </p>
                <p>
                  <span className="text-muted-foreground">Direction:</span>{" "}
                  {report.sample.direction}
                </p>
                <p>
                  <span className="text-muted-foreground">Answered:</span>{" "}
                  {report.sample.answered ? "yes" : "no"}
                </p>
                <p>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  {report.sample.durationSeconds}s
                </p>
                <p>
                  <span className="text-muted-foreground">Time:</span>{" "}
                  {new Date(report.sample.startedAt).toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">Recording:</span>{" "}
                  {report.sample.hasRecording ? "yes" : "no"}
                </p>
                <p>
                  <span className="text-muted-foreground">Transcript:</span>{" "}
                  {report.sample.hasTranscript ? "yes" : "no"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                The account has no calls yet, so the fields could not be checked.
              </p>
            )}
            {report.sampleKeys.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">Fields CallVibe sent:</p>
                <p className="bg-muted rounded p-2 font-mono text-xs break-words">
                  {report.sampleKeys.join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
