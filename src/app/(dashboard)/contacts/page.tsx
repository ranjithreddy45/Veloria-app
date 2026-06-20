import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UsersIcon, UserIcon, Building2Icon } from "lucide-react";

import { getContacts } from "@/actions/contact.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { ContactsTable } from "./_components/contacts-table";

export const metadata: Metadata = { title: "Enquiry" };

// ============================================================
// Contacts List Page
// ============================================================

export default async function ContactsPage() {
  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  const result = await getContacts({ limit: 500 });
  const contacts = result.success ? result.data.data : [];

  const corporate = contacts.filter((c) => c.type === "CORPORATE").length;
  const individual = contacts.filter((c) => c.type === "INDIVIDUAL").length;

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        title="Enquiry"
        help={
          <HelpHint title="What is an Enquiry?">
            <p>
              A <strong>Contact</strong> is a <em>person</em> — a real human in
              your address book, with their name, phone, email, and full
              history.
            </p>
            <p>
              Contacts are permanent and accumulate over time. One contact can
              have many <strong>Leads</strong> (enquiries) and many{" "}
              <strong>Bookings</strong>. Their record rolls up lifetime
              bookings, total revenue, VIP status, and last event date.
            </p>
            <p className="text-foreground/70">
              You don&rsquo;t delete a contact when an enquiry dies — you mark
              that Lead &ldquo;Lost.&rdquo; The person stays.
            </p>
          </HelpHint>
        }
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
      {contacts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 animate-rise-in animate-stagger-1">
          <StatTile
            label="Total contacts"
            value={contacts.length}
            accent="violet"
            icon={<UsersIcon className="size-4" />}
            sub="In your directory"
          />
          <StatTile
            label="Individual"
            value={individual}
            accent="cyan"
            icon={<UserIcon className="size-4" />}
            sub="Personal contacts"
          />
          <StatTile
            label="Corporate"
            value={corporate}
            accent="amber"
            icon={<Building2Icon className="size-4" />}
            sub="Business accounts"
          />
        </div>
      )}
      <div className="animate-rise-in animate-stagger-2">
        <ContactsTable data={contacts} />
      </div>
    </div>
  );
}
