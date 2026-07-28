"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Wifi, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

// ============================================================
// Google Calendar Config Form
// ============================================================

export function GoogleCalendarConfig() {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [syncDirection, setSyncDirection] = useState("both");
  const [createEvents, setCreateEvents] = useState(true);
  const [includeHolds, setIncludeHolds] = useState(false);

  async function handleConnect() {
    // Placeholder: In production, this would redirect to Google OAuth
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setConnected(true);
    setSyncing(false);
  }

  async function handleDisconnect() {
    setConnected(false);
  }

  async function handleSyncNow() {
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncing(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950 dark:to-indigo-950">
              <Calendar className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <CardDescription>
                Automatically sync bookings to your Google Calendar
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              connected
                ? "bg-success/15 text-success border-success/20"
                : "bg-muted text-muted-foreground border-border"
            }
          >
            {connected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Placeholder notice */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This is a preview integration. Connect your Google account to enable
            2-way calendar sync with your CRM bookings.
          </p>
        </div>

        {!connected ? (
          /* Connect button */
          <Button
            onClick={handleConnect}
            disabled={syncing}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {syncing ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Calendar className="mr-2 size-4" />
                Connect Google Calendar
              </>
            )}
          </Button>
        ) : (
          /* Sync settings */
          <div className="space-y-4">
            {/* Connected account */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <CheckCircle2 className="size-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">
                  user@gmail.com (placeholder)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Disconnect
              </Button>
            </div>

            <Separator />

            {/* Sync Direction */}
            <div className="space-y-2">
              <Label>Sync Direction</Label>
              <Select value={syncDirection} onValueChange={setSyncDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">
                    2-Way (CRM ↔ Google Calendar)
                  </SelectItem>
                  <SelectItem value="to-google">
                    CRM → Google Calendar only
                  </SelectItem>
                  <SelectItem value="from-google">
                    Google Calendar → CRM only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Automatic sync</Label>
                <p className="text-xs text-muted-foreground">
                  Sync changes automatically when bookings are created/updated
                </p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>

            {/* Create events for new bookings */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Create calendar events</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create events for confirmed bookings
                </p>
              </div>
              <Switch checked={createEvents} onCheckedChange={setCreateEvents} />
            </div>

            {/* Include holds */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Include hold bookings</Label>
                <p className="text-xs text-muted-foreground">
                  Show tentative/hold bookings in calendar
                </p>
              </div>
              <Switch checked={includeHolds} onCheckedChange={setIncludeHolds} />
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSyncNow}
                disabled={syncing}
                variant="outline"
              >
                <RefreshCw
                  className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
