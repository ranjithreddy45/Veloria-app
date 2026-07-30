import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UsersIcon, UserIcon, Building2Icon, ContactIcon } from "lucide-react";

import { getContacts } from "@/actions/contact.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ContactsTable } from "./_components/contacts-table";
import { EnquiryFilterBar } from "./_components/enquiry-filter-bar";

export const metadata: Metadata = { title: "Enquiry" };

// ============================================================
// Contacts List Page
// ============================================================

interface ContactsPageProps {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const { from, to, status } = await searchParams;

  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  const result = await getContacts({
    limit: 500,
    createdFrom: from,
    createdTo: to,
    enquiryStatus: status,
  });
  const contacts = result.success ? result.data.data : [];
  const isFiltered = !!from || !!to || !!status;

  const corporate = contacts.filter((c) => c.type === "CORPORATE").length;
  const individual = contacts.filter((c) => c.type === "INDIVIDUAL").length;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={ContactIcon}
        accent="blue"
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
              <span className="font-semibold numeric">{contacts.length}</span> total
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              <span className="font-semibold numeric text-foreground/80">{individual}</span> individual ·{" "}
              <span className="font-semibold numeric text-foreground/80">{corporate}</span> corporate
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
      {/* Filter rail — enquiry creation date + status. Always rendered when a
          filter is active, so a zero-result filter can be cleared. */}
      {(contacts.length > 0 || isFiltered) && (
        <div className="animate-rise-in animate-stagger-1">
          <EnquiryFilterBar />
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="animate-rise-in animate-stagger-1 rounded-2xl border border-dashed bg-card shadow-card">
          {isFiltered ? (
            <EmptyState
              icon={<UsersIcon className="size-6" />}
              title="No enquiries match these filters"
              description="Try widening the creation-date range, or clear the status filter to see everything."
            />
          ) : (
            <EmptyState
              icon={<UsersIcon className="size-6" />}
              title="No contacts yet"
              description="This is your address book — every client and prospect you talk to. Add your first contact, and their leads, bookings, and history will roll up here."
              action={
                <Button asChild>
                  <Link href="/contacts/new">
                    <PlusIcon className="size-3.5" strokeWidth={2.5} />
                    New contact
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 animate-rise-in animate-stagger-1">
            <StatTile
              label="Total contacts"
              value={contacts.length}
              accent="gold"
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
          <div className="animate-rise-in animate-stagger-2">
            <ContactsTable data={contacts} />
          </div>
        </>
      )}
    </div>
  );
}
