"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { RotateCcw, Trash2, UserPlus, Users, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { restoreLead, purgeLead } from "@/actions/lead.actions";
import { restoreContact, purgeContact } from "@/actions/contact.actions";
import type { TrashItem } from "@/actions/trash.actions";

interface TrashListProps {
  items: TrashItem[];
}

export function TrashList({ items }: TrashListProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function handleRestore(item: TrashItem) {
    setPending(item.id);
    const action = item.type === "lead" ? restoreLead : restoreContact;
    const result = await action(item.id);
    if (result.success) {
      toast.success(`${item.type === "lead" ? "Lead" : "Contact"} restored`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Restore failed");
    }
    setPending(null);
  }

  async function handlePurge(item: TrashItem) {
    if (
      !window.confirm(
        `Permanently delete this ${item.type}? This cannot be undone.`
      )
    ) {
      return;
    }
    setPending(item.id);
    const action = item.type === "lead" ? purgeLead : purgeContact;
    const result = await action(item.id);
    if (result.success) {
      toast.success("Permanently deleted");
      router.refresh();
    } else {
      toast.error(result.error ?? "Purge failed");
    }
    setPending(null);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center border-b border-border bg-muted/30 px-3 py-2 text-meta font-medium uppercase tracking-[0.05em] text-muted-foreground">
        <div className="flex-1">Item</div>
        <div className="hidden w-36 text-right sm:block">Deleted</div>
        <div className="w-[180px] text-right">Actions</div>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const isLead = item.type === "lead";
          const Icon = isLead ? UserPlus : Users;
          const isBusy = pending === item.id;
          return (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center px-3 py-2.5"
            >
              {/* Item: pill + icon + name/subtitle. flex-1 + min-w-0 so it
                  always wins remaining width and truncates gracefully. */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <StatusPill
                  label={isLead ? "Lead" : "Contact"}
                  hue={isLead ? "indigo" : "blue"}
                  size="xs"
                />
                <Icon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-body font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="truncate text-meta text-muted-foreground">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Deleted timestamp — hidden on narrow screens */}
              <div className="hidden w-36 shrink-0 text-right sm:block">
                <p className="text-detail text-muted-foreground">
                  {formatDistanceToNow(new Date(item.deletedAt), {
                    addSuffix: true,
                  })}
                </p>
                <p
                  className={
                    item.daysLeft <= 3
                      ? "text-meta font-medium text-destructive"
                      : "text-meta text-muted-foreground/70"
                  }
                >
                  {item.daysLeft} day{item.daysLeft === 1 ? "" : "s"} left
                </p>
              </div>

              {/* Actions — fixed width so they never crowd out the name */}
              <div className="flex w-[180px] shrink-0 items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-detail"
                  disabled={isBusy}
                  onClick={() => handleRestore(item)}
                >
                  {isBusy ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-detail text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isBusy}
                  onClick={() => handlePurge(item)}
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
