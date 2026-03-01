import type { Metadata } from "next";
import { InboxIcon } from "lucide-react";

import { getInquiries } from "@/actions/widget.actions";
import { PageHeader } from "@/components/layout/page-header";
import { InquiryTable } from "@/components/widget/inquiry-table";

export const metadata: Metadata = { title: "Widget Inquiries" };

// ============================================================
// Widget Inquiries Dashboard Page
// ============================================================

export default async function InquiriesPage() {
  const result = await getInquiries();

  const inquiries = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Widget Inquiries"
        description="Manage incoming inquiries from the booking widget. Process them to create Contacts and Leads."
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InboxIcon className="size-4" />
          <span>
            {inquiries.filter((i) => !i.isProcessed).length} pending
          </span>
        </div>
      </PageHeader>
      <InquiryTable data={inquiries} />
    </div>
  );
}
