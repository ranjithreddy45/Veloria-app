"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CreditCard, FileText, MessageCircle, Users } from "lucide-react";
import { markMyNotificationsRead, type CustomerNotificationDTO } from "@/actions/guest-concierge.actions";
import { EmptyNote, IconTile, ScreenHeader } from "../../../_components/ui";
import { PushOptIn } from "../../../_components/push-opt-in";

function iconFor(n: CustomerNotificationDTO) {
  if (n.actionUrl?.startsWith("/app/concierge")) return { Icon: MessageCircle, tone: "plum" as const };
  if (n.type.startsWith("PAYMENT") || n.type === "INVOICE_SENT") return { Icon: CreditCard, tone: "plum" as const };
  if (n.type.startsWith("BOOKING")) return { Icon: CalendarDays, tone: "plum" as const };
  if (n.type.startsWith("TASK")) return { Icon: FileText, tone: "gold" as const };
  if (n.type === "RSVP_RECEIVED" || n.type === "INVITATION_SENT" || n.type === "DEAL_WON") return { Icon: Users, tone: "green" as const };
  return { Icon: Bell, tone: "ink" as const };
}

/** "5m", "3h", "2d", measured against the server clock at load. */
function ago(iso: string, now: string) {
  const s = Math.max(0, (Date.parse(now) - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Only follow links that stay inside the customer surfaces. */
function safeHref(url: string | null) {
  if (!url) return null;
  const inApp = url === "/app" || url.startsWith("/app/") || url.startsWith("/app?");
  return inApp || url.startsWith("/portal") || url.startsWith("/pay/") || url.startsWith("/sign/") ? url : null;
}

export function NotificationList({ initial, now }: { initial: CustomerNotificationDTO[]; now: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() {
    const before = items;
    setError(null);
    setItems((x) => x.map((n) => ({ ...n, isRead: true })));
    const res = await markMyNotificationsRead();
    if (!res.success) {
      setItems(before);
      setError(res.error);
    }
  }

  async function open(n: CustomerNotificationDTO) {
    if (!n.isRead) {
      setItems((x) => x.map((m) => (m.id === n.id ? { ...m, isRead: true } : m)));
      await markMyNotificationsRead([n.id]);
    }
    const href = safeHref(n.actionUrl);
    if (href) router.push(href);
  }

  return (
    <div className="vg-rise flex flex-col gap-4 px-5 pt-[calc(var(--sat)+0.5rem)]">
      <ScreenHeader
        title="Notifications"
        backHref="/app"
        action={
          unread > 0 ? (
            <button type="button" onClick={markAll} className="text-detail font-semibold text-[#6d1b52]">
              Mark all read
            </button>
          ) : undefined
        }
      />
      <PushOptIn />
      {error && (
        <p role="alert" className="text-meta text-[#b3261e]">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyNote>Nothing yet. Replies from the team, documents to sign, payments due and RSVPs will arrive here.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => {
            const { Icon, tone } = iconFor(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={`vg-press flex w-full items-start gap-3 rounded-2xl border border-black/[.06] p-3.5 text-left ${n.isRead ? "bg-[#f9f9fa]" : "bg-white"}`}
              >
                <IconTile tone={tone} size={36}>
                  <Icon className="size-[17px]" strokeWidth={1.9} />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="text-body font-semibold">{n.title}</span>
                    <span className="shrink-0 text-meta text-[#8a8a8e]">{ago(n.createdAt, now)}</span>
                  </span>
                  <span className="mt-0.5 block text-detail leading-[1.45] text-[#6e6e73]">{n.message}</span>
                </span>
                {!n.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#6d1b52]">
                    <span className="sr-only">Unread</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
