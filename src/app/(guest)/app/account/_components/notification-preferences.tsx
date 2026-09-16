"use client";

import * as React from "react";
import type { GuestResult } from "@/actions/guest-account.actions";
import type { CustomerNotificationRow } from "../_lib/notification-preferences";
import { Card } from "../../../_components/ui";

// Rendered only while NOTIFICATION_PREFERENCES_ENFORCED is true, so a switch
// here always changes what the senders do.

type Change = { key: string; emailEnabled: boolean; smsEnabled: boolean };

type Props = {
  rows: CustomerNotificationRow[];
  disabled: boolean;
  action: (changes: Change[]) => Promise<GuestResult<{ preferences: CustomerNotificationRow[] }>>;
};

function Switch({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#6d1b52]" : "bg-[#d1d1d6]"}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function NotificationPreferences({ rows: initial, disabled, action }: Props) {
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(key: string, channel: "emailEnabled" | "smsEnabled") {
    const before = rows;
    const next = rows.map((r) => (r.key === key ? { ...r, [channel]: !r[channel] } : r));
    setRows(next);
    setBusy(true);
    setError(null);
    try {
      const res = await action(next.map((r) => ({ key: r.key, emailEnabled: r.emailEnabled, smsEnabled: r.smsEnabled })));
      if (!res.success) {
        setRows(before);
        setError(res.error);
        return;
      }
      setRows(res.data.preferences);
    } catch {
      setRows(before);
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="vg-divide mt-2.5 overflow-hidden">
      <div className="flex items-center justify-end gap-6 px-4 pt-3 text-meta font-semibold uppercase tracking-[.08em] text-[#636368]">
        <span className="w-12 text-center">Email</span>
        <span className="w-12 text-center">Text</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-body font-medium">{r.label}</div>
            <div className="text-meta leading-[1.45] text-[#6e6e73]">{r.description}</div>
          </div>
          <div className="flex items-center gap-6">
            <Switch on={r.emailEnabled} label={`${r.label} by email`} disabled={disabled || busy} onToggle={() => toggle(r.key, "emailEnabled")} />
            <Switch on={r.smsEnabled} label={`${r.label} by text`} disabled={disabled || busy} onToggle={() => toggle(r.key, "smsEnabled")} />
          </div>
        </div>
      ))}
      {error && <p className="px-4 py-3 text-detail text-[#b3261e]">{error}</p>}
    </Card>
  );
}
