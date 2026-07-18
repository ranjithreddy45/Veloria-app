import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  PencilIcon,
  TrashIcon,
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";

import { getContact } from "@/actions/contact.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  LEAD_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
} from "@/lib/constants";
import { CommunicationTimeline } from "@/components/shared/communication-timeline";
import { Contact360Timeline } from "./_components/contact-360-timeline";
import { MacroButton } from "@/components/shared/macro-button";
import { ContactDeleteButton } from "./_components/contact-delete-button";
import { HostInviteButton } from "./_components/host-invite-button";
import { AIEmailComposer } from "@/components/ai/ai-email-composer";
import { WhatsAppQuickSendDialog } from "@/components/shared/whatsapp-quick-send-dialog";
import { SmartSuggestions } from "@/components/ai/smart-suggestions";
import { SentimentTrendChart } from "@/components/ai/sentiment-trend-chart";
import { EnquiryStatusSelect } from "./_components/enquiry-status-select";
import { EnquiryNotesPanel } from "./_components/enquiry-notes-panel";
import { EnquiryRemindersPanel } from "./_components/enquiry-reminders-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { enquiryStatusOption } from "../_components/enquiry-status";

export const metadata: Metadata = { title: "Contact Details" };

// ============================================================
// Contact Detail Page
// ============================================================

interface ContactDetailPageProps {
  params: Promise<{ contactId: string }>;
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { contactId } = await params;
  const result = await getContact(contactId);

  if (!result.success || !result.data) {
    notFound();
  }

  const contact = result.data;
  const statusOption = enquiryStatusOption(contact.enquiryStatus);

  // Format currency in Indian format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function formatCurrency(value: any) {
    if (!value) return "--";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.firstName} {contact.lastName}
            </h1>
            <StatusPill label={statusOption.label} hue={statusOption.hue} size="sm" />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {contact.company ? `${contact.designation ? contact.designation + " at " : ""}${contact.company}` : contact.type === "CORPORATE" ? "Corporate Contact" : "Individual Contact"}
            {contact.enquiryStatusAt && (
              <> · status updated {format(new Date(contact.enquiryStatusAt), "dd MMM yyyy")}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnquiryStatusSelect
            contactId={contact.id}
            currentStatus={contact.enquiryStatus ?? null}
          />
          <AIEmailComposer
            contactId={contact.id}
            contactName={`${contact.firstName} ${contact.lastName}`}
            contactEmail={contact.email}
          />
          <WhatsAppQuickSendDialog
            contactId={contact.id}
            contactName={`${contact.firstName} ${contact.lastName}`}
            contactPhone={contact.phone}
          />
          <MacroButton entityType="CONTACT" entityId={contact.id} />
          {contact.email && <HostInviteButton contactId={contact.id} />}
          <Button variant="outline" asChild>
            <Link href={`/contacts/${contact.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
          <ContactDeleteButton
            contactId={contact.id}
            contactName={`${contact.firstName} ${contact.lastName}`}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">
            Leads ({contact.leads.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            Bookings ({contact.bookings.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({contact.invoices.length})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Communications
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <UserIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Type</p>
                    <StatusBadge
                      status={contact.type}
                      colorMap={{
                        INDIVIDUAL: "bg-blue-100 text-blue-800 border-blue-200",
                        CORPORATE: "bg-purple-100 text-purple-800 border-purple-200",
                      }}
                    />
                  </div>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <MailIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="text-sm">{contact.email}</p>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Phone</p>
                      <p className="text-sm">{contact.phone}</p>
                    </div>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <BuildingIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Company</p>
                      <p className="text-sm">
                        {contact.company}
                        {contact.designation && ` (${contact.designation})`}
                      </p>
                    </div>
                  </div>
                )}
                {(contact.address || contact.city || contact.state) && (
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Address</p>
                      <p className="text-sm">
                        {[contact.address, contact.city, contact.state, contact.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CalendarIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Created</p>
                    <p className="text-sm">
                      {format(new Date(contact.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags & Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">Tags</p>
                  {contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No tags</p>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {contact.notes || "No notes"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes & call log + reminders — parity with the lead detail page.
              Both write through the shared CRM actions, so a reminder booked
              here shows up on /calendar and notifies the assignee. */}
          <div className="grid gap-6 md:grid-cols-2">
            <EnquiryNotesPanel contactId={contact.id} />
            <EnquiryRemindersPanel contactId={contact.id} />
          </div>

          {/* Smart Suggestions */}
          <SmartSuggestions entityType="contact" entityId={contact.id} />

          {/* Sentiment Trend */}
          <SentimentTrendChart contactId={contact.id} />
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Associated Leads</CardTitle>
              <Button size="sm" asChild>
                <Link href={`/leads/new?contactId=${contact.id}`}>
                  Add Lead
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {contact.leads.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No leads associated with this contact yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {contact.leads.map((lead: { id: string; title: string; status: string; source: string; eventType: string | null; eventDate: Date | string | null; assignedTo: { name: string | null } | null }) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium hover:underline"
                        >
                          {lead.title}
                        </Link>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                          {lead.eventType && <span>{lead.eventType}</span>}
                          {lead.eventDate && (
                            <span>
                              {format(new Date(lead.eventDate), "dd MMM yyyy")}
                            </span>
                          )}
                          {lead.assignedTo && (
                            <span>Assigned to: {lead.assignedTo.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={lead.source}
                          colorMap={{
                            WEBSITE: "bg-blue-100 text-blue-800 border-blue-200",
                            REFERRAL: "bg-green-100 text-green-800 border-green-200",
                            SOCIAL_MEDIA: "bg-pink-100 text-pink-800 border-pink-200",
                            WALK_IN: "bg-amber-100 text-amber-800 border-amber-200",
                            PHONE_INQUIRY: "bg-cyan-100 text-cyan-800 border-cyan-200",
                            EMAIL: "bg-indigo-100 text-indigo-800 border-indigo-200",
                            EVENT: "bg-purple-100 text-purple-800 border-purple-200",
                            PARTNER: "bg-teal-100 text-teal-800 border-teal-200",
                            ADVERTISEMENT: "bg-orange-100 text-orange-800 border-orange-200",
                            OTHER: "bg-muted text-foreground border-border",
                          }}
                          label={LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
                        />
                        <StatusBadge
                          status={lead.status}
                          colorMap={LEAD_STATUS_COLORS}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Associated Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.bookings.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No bookings associated with this contact yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {contact.bookings.map((booking: any) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{booking.eventName}</p>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                          <span>{booking.eventType}</span>
                          <span>
                            {format(new Date(booking.date), "dd MMM yyyy")}
                          </span>
                          <span>{booking.venue.name}</span>
                          <span>{booking.guestCount} guests</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(booking.totalAmount)}
                        </span>
                        <StatusBadge
                          status={booking.status}
                          colorMap={BOOKING_STATUS_COLORS}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Associated Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.invoices.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No invoices associated with this contact yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {contact.invoices.map((invoice: any) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <div className="text-muted-foreground mt-1 text-xs">
                          Issued: {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                          {" | "}
                          Due: {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                          {Number(invoice.balanceDue) > 0 && (
                            <p className="text-destructive text-xs">
                              Due: {formatCurrency(invoice.balanceDue)}
                            </p>
                          )}
                        </div>
                        <StatusBadge
                          status={invoice.status}
                          colorMap={{
                            DRAFT: "bg-muted text-foreground border-border",
                            SENT: "bg-blue-100 text-blue-800 border-blue-200",
                            PARTIALLY_PAID: "bg-amber-100 text-amber-800 border-amber-200",
                            PAID: "bg-green-100 text-green-800 border-green-200",
                            OVERDUE: "bg-red-100 text-red-800 border-red-200",
                            CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
                            REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Communications Tab */}
        <TabsContent value="communications" className="mt-6">
          <CommunicationTimeline contactId={contact.id} />
        </TabsContent>

        {/* 360° Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <Contact360Timeline contactId={contact.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
