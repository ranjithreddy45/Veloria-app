import type { Metadata } from "next";
import { InboxIcon, MailOpenIcon, CheckCircle2Icon } from "lucide-react";

import { getInquiries } from "@/actions/widget.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { InquiryTable } from "@/components/widget/inquiry-table";

export const metadata: Metadata = { title: "Widget Inquiries" };

// ============================================================
// Widget Inquiries Dashboard Page
// ============================================================

export default async function InquiriesPage() {
  const result = await getInquiries();

  const inquiries = result.success ? result.data.data : [];

  const total = inquiries.length;
  const pending = inquiries.filter((i) => !i.isProcessed).length;
  const processed = total - pending;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Acquisition · Widget</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{pending}</span> pending
            </span>
          </div>
        }
        title="Widget Inquiries"
        help={<PageHelp id="inquiries" />}
        description="Manage incoming inquiries from the booking widget. Process them to create Contacts and Leads."
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InboxIcon className="size-4" />
          <span>{pending} pending</span>
        </div>
      </PageHeader>

      {total > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-rise-in animate-stagger-1">
          <StatTile
            label="Total inquiries"
            value={total}
            accent="gold"
            icon={<InboxIcon className="size-4" />}
            sub="From the booking widget"
          />
          <StatTile
            label="Pending"
            value={pending}
            accent="amber"
            icon={<MailOpenIcon className="size-4" />}
            sub="Awaiting processing"
          />
          <StatTile
            label="Processed"
            value={processed}
            accent="emerald"
            icon={<CheckCircle2Icon className="size-4" />}
            sub="Converted to leads"
          />
        </div>
      )}

      <div className="animate-rise-in animate-stagger-2">
        {total === 0 ? (
          <div className="rounded-xl border border-dashed bg-card shadow-premium">
            <EmptyState
              icon={<InboxIcon className="size-6" />}
              title="No inquiries yet"
              description="This is your unopened mailbox — enquiries from your booking widget and web forms land here automatically. Once they arrive, process each one to create a Contact and Lead."
            />
          </div>
        ) : (
          <InquiryTable data={inquiries} />
        )}
      </div>
    </div>
  );
}
