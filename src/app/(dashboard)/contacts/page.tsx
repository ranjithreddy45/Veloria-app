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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage your contacts and client relationships."
      >
        <Button asChild>
          <Link href="/contacts/new">
            <PlusIcon className="mr-2 size-4" />
            New Contact
          </Link>
        </Button>
      </PageHeader>
      <ContactsTable data={contacts} />
    </div>
  );
}
