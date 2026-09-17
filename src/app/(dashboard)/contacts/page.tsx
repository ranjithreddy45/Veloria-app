import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UsersIcon, UserIcon, Building2Icon, ContactIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CHANNEL_TAG_LIST } from "@/lib/enquiry-source-backfill";
import { EnquiryRepairButton } from "./_components/enquiry-repair-button";
import { CleanupEmptyFbButton } from "./_components/cleanup-empty-fb-button";
import { getContacts } from "@/actions/contact.actions";
import { getVenues } from "@/actions/booking.actions";
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
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    venue?: string;
    source?: string;
    repeat?: string;
  }>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const { from, to, status, venue, source, repeat } = await searchParams;

  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  // ?repeat=1 — the people who have raised more than one enquiry. This is the
  // answer to "which enquirers gave multiple leads": a Contact is a person, a
  // Lead is one event, and the difference between the two headline numbers IS
  // this list.
  const repeatOnly = repeat === "1";

  const [session, result, venuesResult] = await Promise.all([
    auth(),
    getContacts({
      limit: 500,
      createdFrom: from,
      createdTo: to,
      enquiryStatus: status,
      venueId: venue,
      enquirySource: source,
      repeatOnly,
    }),
    getVenues({ activeOnly: true }),
  ]);
  const allLoaded = result.success ? result.data.data : [];

  // The DB filter narrows to "has at least one lead"; Prisma cannot filter on a
  // relation COUNT, so the >1 cut happens here over the counts already loaded.
  const contacts = repeatOnly
    ? allLoaded.filter(
        (c) => ((c as { _count?: { leads?: number } })._count?.leads ?? 0) > 1
      )
    : allLoaded;

  const repeatCount = allLoaded.filter(
    (c) => ((c as { _count?: { leads?: number } })._count?.leads ?? 0) > 1
  ).length;
  const extraLeads = allLoaded.reduce(
    (n, c) => n + Math.max(0, ((c as { _count?: { leads?: number } })._count?.leads ?? 0) - 1),
    0
  );
  // The TRUE row count, not contacts.length.
  //
  // getContacts already returns a real prisma.contact.count alongside the rows,
  // and the header was printing the length of the LOADED array instead. Today
  // that happens to agree, because 142 contacts fit inside the 500-row ceiling.
  // Past 500 it would have frozen at "500 total" while the real number kept
  // growing — a header quietly contradicting the database, which is the exact
  // failure the leads list had at 100.
  const totalContacts = result.success ? result.data.total : contacts.length;
  const contactsTruncated = contacts.length < totalContacts;

  // Only offer the one-off tidy-up to an admin, and only while there is
  // something left to tidy — otherwise it is a button that does nothing.
  // No session → no role → no repair button. Fail closed.
  const canRepair =
    !!session?.user?.role && hasPermission(session.user.role, "settings:update");
  const repairable = canRepair
    ? await prisma.contact.count({
        where: {
          deletedAt: null,
          OR: [{ enquirySource: null }, { tags: { hasSome: CHANNEL_TAG_LIST } }],
        },
      })
    : 0;
  // Empty "Facebook Lead" placeholders (name "Facebook Lead", no phone/email) —
  // offer a one-click removal, admin only, and only while some exist.
  const canPushToCallVibe =
    !!session?.user?.role && hasPermission(session.user.role, "contacts:update");
  const canDeleteContacts =
    !!session?.user?.role && hasPermission(session.user.role, "contacts:delete");
  const emptyFbCount = canDeleteContacts
    ? await prisma.contact.count({
        where: {
          deletedAt: null,
          firstName: { equals: "Facebook", mode: "insensitive" },
          lastName: { equals: "Lead", mode: "insensitive" },
          phone: null,
          email: null,
          bookings: { none: {} },
        },
      })
    : 0;
  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ id: v.id, name: v.name }))
    : [];
  const isFiltered = !!from || !!to || !!status || !!venue || !!source;

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
              <span className="font-semibold numeric">{totalContacts}</span> total
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
        {emptyFbCount > 0 && <CleanupEmptyFbButton count={emptyFbCount} />}
        {/*
          Explains the two headline numbers instead of leaving them to be
          discovered as a contradiction. Enquiries counts PEOPLE, Leads counts
          EVENTS, and the difference is exactly these repeat customers — which
          is good news, so it is worth naming rather than hiding.
        */}
        {(repeatCount > 0 || repeatOnly) && (
          <Link
            href={repeatOnly ? "/contacts" : "/contacts?repeat=1"}
            className={
              repeatOnly
                ? "rounded-lg border border-primary bg-primary px-3 py-1.5 text-detail font-medium text-primary-foreground"
                : "rounded-lg border border-border bg-card px-3 py-1.5 text-detail text-foreground/80 hover:bg-muted"
            }
          >
            {repeatOnly
              ? "Showing repeat enquirers — show all"
              : `${repeatCount} repeat enquirer${repeatCount === 1 ? "" : "s"} (+${extraLeads} extra lead${extraLeads === 1 ? "" : "s"})`}
          </Link>
        )}
        {/* A cap that does not announce itself reads as "this is all of it". */}
        {contactsTruncated && (
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-detail text-foreground/80">
            Showing {contacts.length} of {totalContacts} — narrow the filters to see the rest.
          </span>
        )}
        {repairable > 0 && <EnquiryRepairButton affected={repairable} />}
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
          <EnquiryFilterBar venues={venues} />
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
            <ContactsTable data={contacts} canPushToCallVibe={canPushToCallVibe} />
          </div>
        </>
      )}
    </div>
  );
}
