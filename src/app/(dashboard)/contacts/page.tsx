import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getContacts } from "@/actions/contact.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "./_components/contacts-table";

export const metadata: Metadata = { title: "Contacts" };

// ============================================================
// Contacts List Page
// ============================================================

export default async function ContactsPage() {
  const result = await getContacts();
  const contacts = result.success ? result.data.data : [];

  const corporate = contacts.filter((c) => c.type === "CORPORATE").length;
  const individual = contacts.filter((c) => c.type === "INDIVIDUAL").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        eyebrow={
          <div className="flex items-center gap-3">
            <span>CRM · Directory</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{contacts.length}</span> total
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              <span className="font-semibold tabular-nums text-foreground/80">{individual}</span> individual ·{" "}
              <span className="font-semibold tabular-nums text-foreground/80">{corporate}</span> corporate
            </span>
          </div>
        }
        description="Your people. Every conversation, deal, and booking ties back here."
      >
        <Button asChild>
          <Link href="/contacts/new">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New contact
          </Link>
        </Button>
      </PageHeader>
      <ContactsTable data={contacts} />
    </div>
  );
}
