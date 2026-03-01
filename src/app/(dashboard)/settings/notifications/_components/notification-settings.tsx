"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  Save,
  AlertCircle,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  updateNotificationPreferences,
  type NotificationPreference,
} from "@/actions/notification-settings.actions";

// ============================================================
// Notification Settings Client Component
// ============================================================

const STORAGE_KEY = "veloria_notification_preferences";

interface NotificationSettingsProps {
  initialPreferences: NotificationPreference[];
}

export function NotificationSettings({
  initialPreferences,
}: NotificationSettingsProps) {
  const [preferences, setPreferences] =
    useState<NotificationPreference[]>(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load preferences from localStorage on mount (placeholder persistence)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPreference[];
        // Merge stored with initial to handle new notification types
        const merged = initialPreferences.map((initial) => {
          const saved = parsed.find((p) => p.key === initial.key);
          return saved
            ? { ...initial, emailEnabled: saved.emailEnabled, smsEnabled: saved.smsEnabled }
            : initial;
        });
        setPreferences(merged);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [initialPreferences]);

  const handleToggle = useCallback(
    (key: string, channel: "emailEnabled" | "smsEnabled", value: boolean) => {
      setPreferences((prev) =>
        prev.map((p) => (p.key === key ? { ...p, [channel]: value } : p))
      );
      setDirty(true);
    },
    []
  );

  async function handleSave() {
    setSaving(true);
    try {
      // Persist to localStorage (placeholder for DB)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));

      // Also call server action for logging / future DB persistence
      const result = await updateNotificationPreferences(preferences);

      if (result.success) {
        setDirty(false);
        toast.success("Notification preferences saved");
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    } catch {
      toast.error("An error occurred while saving preferences");
    } finally {
      setSaving(false);
    }
  }

  const emailCount = preferences.filter((p) => p.emailEnabled).length;
  const smsCount = preferences.filter((p) => p.smsEnabled).length;

  return (
    <div className="space-y-6">
      {/* SMS Placeholder Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            SMS is in placeholder mode
          </p>
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            SMS messages are currently logged to the console. Connect a provider
            like Twilio to send real SMS notifications.
          </p>
        </div>
      </div>

      {/* Summary Badges */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5 px-3 py-1">
          <Mail className="size-3.5" />
          {emailCount} email{emailCount !== 1 ? "s" : ""} active
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1">
          <MessageSquare className="size-3.5" />
          {smsCount} SMS active
        </Badge>
      </div>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Bell className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Notification Channels</CardTitle>
              <CardDescription>
                Choose which notifications are sent via email and SMS.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Column Headers */}
          <div className="mb-3 flex items-center border-b pb-3">
            <div className="flex-1 text-sm font-medium text-muted-foreground">
              Notification Type
            </div>
            <div className="flex w-[180px] items-center justify-center gap-8">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Mail className="size-3.5" />
                Email
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquare className="size-3.5" />
                SMS
              </span>
            </div>
          </div>

          {/* Preference Rows */}
          <div className="divide-y">
            {preferences.map((pref) => (
              <div
                key={pref.key}
                className="flex items-center py-4 first:pt-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {pref.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {pref.description}
                  </p>
                </div>
                <div className="flex w-[180px] items-center justify-center gap-8">
                  <Switch
                    checked={pref.emailEnabled}
                    onCheckedChange={(checked) =>
                      handleToggle(pref.key, "emailEnabled", checked)
                    }
                    aria-label={`Email for ${pref.label}`}
                  />
                  <Switch
                    checked={pref.smsEnabled}
                    onCheckedChange={(checked) =>
                      handleToggle(pref.key, "smsEnabled", checked)
                    }
                    aria-label={`SMS for ${pref.label}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          <Save className="mr-2 size-4" />
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
        {!dirty && preferences.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            All changes saved
          </span>
        )}
      </div>
    </div>
  );
}
