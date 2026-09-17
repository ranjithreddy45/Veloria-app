"use client";

// ============================================================
// Lead push (Write) — settings for sending CRM contacts into CallVibe so its
// agents can call them. Uses the account saved above; there is no second
// login. "Send test lead" pushes one real lead and shows what CallVibe
// answered, because CallVibe publishes no response format for leads.
// ============================================================

import { useState, useTransition } from "react";
import { Loader2, Save, Send, Users } from "lucide-react";
import { toast } from "sonner";

import {
  getCallVibeAgentNames,
  saveCallVibePushSettings,
  sendCallVibeTestLead,
} from "@/actions/callvibe-push.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface CallVibePushSettingsData {
  connected: boolean;
  pushEnabled?: boolean;
  pushDefaultAssignee?: string | null;
  pushCallingList?: string | null;
  lastPushAt?: Date | null;
  lastPushStatus?: string | null;
  lastPushError?: string | null;
  waiting?: number;
  failedLast7Days?: number;
}

interface TestResult {
  phone: string;
  httpStatus: number;
  leadId: string | null;
  responseKeys: string[];
  noteAdded: boolean;
  noteError: string | null;
}

export function CallVibePushSection({ initial }: { initial: CallVibePushSettingsData | null }) {
  const connected = !!initial?.connected;
  const [pushEnabled, setPushEnabled] = useState(initial?.pushEnabled ?? false);
  const [assignee, setAssignee] = useState(initial?.pushDefaultAssignee ?? "");
  const [callingList, setCallingList] = useState(initial?.pushCallingList ?? "");
  const [agents, setAgents] = useState<string[] | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [loadingAgents, startAgents] = useTransition();
  const [testing, startTest] = useTransition();

  function handleSave() {
    startSave(async () => {
      const res = await saveCallVibePushSettings({
        pushEnabled,
        pushDefaultAssignee: assignee.trim() || null,
        pushCallingList: callingList.trim() || null,
      });
      if (res.success) toast.success("Lead push settings saved");
      else toast.error(res.error);
    });
  }

  function handleLoadAgents() {
    startAgents(async () => {
      const res = await getCallVibeAgentNames();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (res.data === null) {
        toast.error("CallVibe answered, but not with a list of agents this app can read");
        return;
      }
      setAgents(res.data);
    });
  }

  function handleTest() {
    setTestResult(null);
    setTestError(null);
    startTest(async () => {
      const res = await sendCallVibeTestLead({ phone: testPhone, name: testName || undefined });
      if (res.success) {
        setTestResult(res.data);
        toast.success("CallVibe accepted the test lead");
      } else {
        setTestError(res.error);
      }
    });
  }

  const statusBadge =
    initial?.lastPushStatus === "SUCCESS" ? (
      <Badge variant="success">Succeeded</Badge>
    ) : initial?.lastPushStatus === "FAILED" ? (
      <Badge variant="destructive">Failed</Badge>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead push (Write)</CardTitle>
        <CardDescription>
          Send contacts into CallVibe so agents can call them. A lead is matched by phone number, so
          pushing the same contact again updates its CallVibe lead instead of adding another. Pushes
          run in the background and retry if CallVibe is busy or down; saving a contact never waits
          on them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            Save the CallVibe account above first. The push uses the same login.
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Push new leads automatically</p>
            <p className="text-muted-foreground text-sm">
              Every new enquiry, from any source, is sent to CallVibe as soon as it is saved.
            </p>
          </div>
          <Switch id="callvibe-push-enabled" checked={pushEnabled} onCheckedChange={setPushEnabled} disabled={!connected} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="callvibe-push-assignee">Default agent</Label>
            <Input
              id="callvibe-push-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Exact agent name in CallVibe"
              list="callvibe-agent-names"
              disabled={!connected}
            />
            {agents && (
              <datalist id="callvibe-agent-names">
                {agents.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            )}
            <p className="text-muted-foreground text-xs">
              Used when the CRM lead&apos;s owner isn&apos;t a CallVibe agent. Leave blank to keep
              CallVibe&apos;s own assignment.{" "}
              {agents && (agents.length ? `Agents: ${agents.join(", ")}` : "CallVibe returned no agents.")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadAgents}
              disabled={!connected || loadingAgents}
            >
              {loadingAgents ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Users className="mr-2 size-4" />}
              Load agents from CallVibe
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="callvibe-push-list">Calling list tag</Label>
            <Input
              id="callvibe-push-list"
              value={callingList}
              onChange={(e) => setCallingList(e.target.value)}
              placeholder="e.g. Wedding enquiries"
              disabled={!connected}
            />
            <p className="text-muted-foreground text-xs">
              Saved on each lead as the custom field <span className="font-mono">calling_list</span>.
              CallVibe has no calling-list API, so filter on this field inside CallVibe.
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={!connected || saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save lead push settings
        </Button>

        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Last push</span>
            {statusBadge}
            <span className="text-muted-foreground">
              {initial?.lastPushAt ? new Date(initial.lastPushAt).toLocaleString() : "Nothing pushed yet"}
            </span>
          </div>
          {initial?.lastPushError && <p className="text-muted-foreground break-words">{initial.lastPushError}</p>}
          {connected && (
            <p className="text-muted-foreground">
              {initial?.waiting ?? 0} waiting or retrying · {initial?.failedLast7Days ?? 0} failed in the last 7 days
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Send test lead</p>
            <p className="text-muted-foreground text-sm">
              Creates a real lead in CallVibe, so use a number you own. It is tagged
              <span className="font-mono"> veloria_test</span> and gets a note saying it is safe to delete.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="callvibe-test-phone">Phone number</Label>
              <Input
                id="callvibe-test-phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
                disabled={!connected}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="callvibe-test-name">Name (optional)</Label>
              <Input
                id="callvibe-test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Veloria test lead"
                disabled={!connected}
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleTest} disabled={!connected || testing || !testPhone.trim()}>
            {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            Send test lead
          </Button>

          {testError && (
            <p className="text-destructive text-sm break-words" role="alert">
              {testError}
            </p>
          )}
          {testResult && (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Accepted for</span> {testResult.phone}{" "}
                <span className="text-muted-foreground">(HTTP {testResult.httpStatus})</span>
              </p>
              <p>
                <span className="text-muted-foreground">CallVibe lead id:</span>{" "}
                {testResult.leadId ?? "not in the response (the phone number is the key)"}
              </p>
              <p>
                <span className="text-muted-foreground">Note:</span>{" "}
                {testResult.noteAdded ? "added" : `not added — ${testResult.noteError}`}
              </p>
              {testResult.responseKeys.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Fields CallVibe sent back:</p>
                  <p className="bg-muted rounded p-2 font-mono text-xs break-words">
                    {testResult.responseKeys.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
