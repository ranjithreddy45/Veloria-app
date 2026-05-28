import type { Metadata } from "next";
import { Trash2 } from "lucide-react";

import { getTrash } from "@/actions/trash.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TrashList } from "./_components/trash-list";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const result = await getTrash();
  const items = result.success && result.data ? result.data : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trash"
        eyebrow={
          <div className="flex items-center gap-3">
            <span>Settings · Recoverable</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{items.length}</span>{" "}
              item{items.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        description="Deleted leads and contacts are recoverable for 30 days. After that they are permanently purged by a daily cron job."
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
          <Trash2 className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] font-medium text-foreground">
            Trash is empty
          </p>
          <p className="max-w-md text-[12px] text-muted-foreground">
            Items you delete from Leads or Contacts will appear here. You can
            restore them anytime within 30 days.
          </p>
        </div>
      ) : (
        <TrashList items={items} />
      )}
    </div>
  );
}
