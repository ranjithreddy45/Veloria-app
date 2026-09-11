"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, CalendarDays, CreditCard, Users, Bell } from "lucide-react";
import { markGuestNotificationsRead, type GuestNotification } from "@/actions/guest-host.actions";
import { ScreenHeader, EmptyNote, IconTile } from "../../../_components/ui";

function iconFor(type: string) {
  if (type.startsWith("PAYMENT") || type === "INVOICE_SENT") return { Icon: CreditCard, tone: "plum" as const };
  if (type.startsWith("BOOKING")) return { Icon: CalendarDays, tone: "plum" as const };
  if (type.startsWith("TASK")) return { Icon: FileText, tone: "gold" as const };
  if (type === "DEAL_WON") return { Icon: Users, tone: "green" as const };
  return { Icon: Bell, tone: "ink" as const };
}
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
/** Only follow links that stay inside the customer surfaces. */
function safeHref(url: string | null) {
  if (!url) return null;
  return url.startsWith("/app") || url.startsWith("/portal") || url.startsWith("/pay/") || url.startsWith("/sign/") ? url : null;
}

export function NotificationList({ initial }: { initial: GuestNotification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() { setItems((x) => x.map((n) => ({ ...n, isRead: true }))); await markGuestNotificationsRead(); router.refresh(); }
  async function open(n: GuestNotification) {
    if (!n.isRead) { setItems((x) => x.map((m) => (m.id === n.id ? { ...m, isRead: true } : m))); await markGuestNotificationsRead([n.id]); }
    const href = safeHref(n.actionUrl); if (href) router.push(href);
  }

  return (
    <div className="vg-rise flex flex-col gap-4 px-5 pt-[calc(var(--sat)+0.5rem)]">
      <ScreenHeader title="Notifications" backHref="/app" action={unread > 0 ? <button type="button" onClick={markAll} className="text-detail font-semibold text-[#6d1b52]">Mark all read</button> : undefined} />
      {items.length === 0 ? <EmptyNote>Nothing yet. Updates about your event — documents to sign, payments due, RSVPs — will arrive here.</EmptyNote> : (
        <div className="flex flex-col gap-2">
          {items.map((n) => {
            const { Icon, tone } = iconFor(n.type);
            return (
              <button key={n.id} type="button" onClick={() => open(n)} className={`vg-press flex w-full items-start gap-3 rounded-2xl border border-black/[.06] p-3.5 text-left ${n.isRead ? "bg-[#f9f9fa]" : "bg-white"}`}>
                <IconTile tone={tone} size={36}><Icon className="size-[17px]" strokeWidth={1.9} /></IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className="text-body font-semibold">{n.title}</span><span className="shrink-0 text-meta text-[#8a8a8e]">{ago(n.createdAt)}</span></span>
                  <span className="mt-0.5 block text-detail leading-[1.45] text-[#6e6e73]">{n.message}</span>
                </span>
                {!n.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#6d1b52]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
