import type { Metadata } from "next";
import { Mail, ShieldCheck } from "lucide-react";
import { RETENTION_DEFAULTS, grievanceOfficer } from "@/lib/privacy/policy";
import { PrivacyRequestForm } from "./_components/privacy-request-form";

// ============================================================
// PUBLIC — Privacy Policy (India DPDP Act 2023) for Veloria Grand /
// Billion Events, Bengaluru. Plain English on purpose: this page is linked
// from every consent checkbox, so a guest on a phone must be able to read it
// in a minute. Retention numbers and the Grievance Officer come from
// src/lib/privacy/policy.ts (env-driven) — never edit them in the copy here.
// ============================================================

export const metadata: Metadata = {
  title: "Privacy Policy — Veloria Grand",
  description:
    "How Veloria Grand (Billion Events, Bengaluru) collects, uses, shares and keeps your personal data, and how to exercise your rights under India's DPDP Act 2023.",
};

const POLICY_LAST_UPDATED = "15 September 2026";

const COMPANY = {
  brand: "Veloria Grand",
  legal: "Billion Events",
  city: "Bengaluru, Karnataka, India",
} as const;

export default function PrivacyPolicyPage() {
  const officer = grievanceOfficer();
  const r = RETENTION_DEFAULTS;

  return (
    <article className="space-y-10">
      {/* Header */}
      <header className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-5 text-h1 text-foreground">Privacy Policy</h1>
        <p className="mx-auto mt-3 max-w-md text-copy leading-relaxed text-muted-foreground">
          How {COMPANY.brand} collects, uses and protects your personal data — and how to ask us
          to see, fix or delete it.
        </p>
        <p className="mt-3 text-meta uppercase tracking-[0.16em] text-muted-foreground/70">
          Last updated {POLICY_LAST_UPDATED}
        </p>
      </header>

      <Section title="Who we are">
        <p>
          {COMPANY.brand} is a venue and events business run by {COMPANY.legal}, based in{" "}
          {COMPANY.city}. When you enquire, book a visit, hold a date, RSVP to an event held with
          us, apply for a job, or enter a guest draw, we become the &ldquo;Data Fiduciary&rdquo; for
          the personal data you give us under India&rsquo;s Digital Personal Data Protection Act,
          2023 (the &ldquo;DPDP Act&rdquo;). This policy explains what that means in practice.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Contact details</strong> — your name, phone number,
            email address and, for bookings, your billing address and GSTIN if you give one.
          </li>
          <li>
            <strong className="text-foreground">Event details</strong> — the occasion, preferred
            dates, guest count, budget, menu choices and any notes you share so we can plan it.
          </li>
          <li>
            <strong className="text-foreground">Payments</strong> — amounts, invoice and receipt
            numbers, and the payment reference. Card, UPI and bank details are entered directly
            with our payment processor (Razorpay); we never see or store them.
          </li>
          <li>
            <strong className="text-foreground">Guest lists and RSVPs</strong> — names and phone
            numbers of guests that a host uploads to send invitations, and each guest&rsquo;s
            response, plus-ones and dietary preferences.
          </li>
          <li>
            <strong className="text-foreground">Photos</strong> — readiness and event-day photos our
            team takes at the venue, and photos you choose to share with us.
          </li>
          <li>
            <strong className="text-foreground">Job applications</strong> — your CV, contact details
            and the details you enter on our careers page.
          </li>
          <li>
            <strong className="text-foreground">Technical data</strong> — a one-way hash of your IP
            address and your browser type when you submit a form, kept only to prevent abuse. We do
            not store your raw IP address.
          </li>
        </ul>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To respond to your enquiry and prepare a quotation.</li>
          <li>To schedule and confirm venue visits, menu tastings and date holds.</li>
          <li>To plan, run and deliver the event you book with us.</li>
          <li>To issue invoices and receipts and to keep the accounts the law requires us to keep.</li>
          <li>To send invitations and collect RSVPs on a host&rsquo;s behalf.</li>
          <li>To consider your job application.</li>
          <li>
            To send you service messages about your enquiry or event by phone, SMS, email or
            WhatsApp. Marketing messages are only sent where you have agreed, and you can opt out
            at any time by replying STOP or emailing us.
          </li>
        </ul>
        <p>
          We rely on your <strong className="text-foreground">consent</strong>, given by ticking the
          box on our forms, and — for bookings and invoices — on the{" "}
          <strong className="text-foreground">legitimate uses</strong> the DPDP Act allows, such as
          performing the contract you have asked for and meeting our legal obligations.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep personal data only as long as we need it for the purpose it was collected, or as
          long as the law requires. Our default retention periods are:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-meta uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Kept for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="px-4 py-2.5">Enquiries that do not become a booking</td>
                <td className="px-4 py-2.5">
                  {r.enquiriesMonthsAfterLastActivity} months after the last activity
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">Bookings, invoices, payments and receipts</td>
                <td className="px-4 py-2.5">
                  {r.bookingsYears} years — required by Indian tax and GST record-keeping rules
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">Guest lists, invitations and RSVPs</td>
                <td className="px-4 py-2.5">{r.guestListsMonthsAfterEvent} months after the event</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">Job applications that do not lead to a hire</td>
                <td className="px-4 py-2.5">{r.jobApplicationsMonths} months</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-detail text-muted-foreground">
          When a period ends we delete the data or anonymise it so it can no longer identify you.
          Financial records are kept for the full statutory period even if you ask us to erase
          other data, because the law requires it.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>We do not sell personal data. We share it only with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Our payment processor</strong> (Razorpay) — to take
            payments and issue refunds.
          </li>
          <li>
            <strong className="text-foreground">Our messaging provider</strong> — to deliver the
            WhatsApp, SMS and email messages described above.
          </li>
          <li>
            <strong className="text-foreground">Vendors working on your event</strong> — caterers,
            decorators, photographers and similar partners receive only what they need to deliver
            their part of your event, and only for that event.
          </li>
          <li>
            <strong className="text-foreground">Your hosts</strong> — if you RSVP to an event, your
            response is shared with the people hosting it.
          </li>
          <li>
            <strong className="text-foreground">Authorities</strong> — where the law requires it.
          </li>
        </ul>
        <p>
          Our systems and providers store data in secure data centres; where a provider processes
          data outside India, we do so only as permitted under the DPDP Act.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under the DPDP Act you can, at any time:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Access</strong> — ask for a summary of the personal
            data we hold about you and how we have used it.
          </li>
          <li>
            <strong className="text-foreground">Correction</strong> — ask us to fix data that is
            wrong, incomplete or out of date.
          </li>
          <li>
            <strong className="text-foreground">Erasure</strong> — ask us to delete your data where
            we no longer need it for the purpose it was collected or for a legal requirement.
          </li>
          <li>
            <strong className="text-foreground">Withdraw consent</strong> — as easily as you gave
            it. Withdrawing does not affect what was done before, and we may still have to keep
            records the law requires.
          </li>
          <li>
            <strong className="text-foreground">Grievance redressal</strong> — raise a complaint
            with our Grievance Officer, and if you are not satisfied with our response, with the
            Data Protection Board of India.
          </li>
          <li>
            <strong className="text-foreground">Nominate</strong> — name someone to exercise these
            rights for you if you are unable to.
          </li>
        </ul>
        <p>
          To use any of these rights, send us a request below or write to the Grievance Officer. We
          will confirm it is you, then respond within 30 days.
        </p>
      </Section>

      <Section title="Make a request">
        <PrivacyRequestForm />
      </Section>

      {/* Grievance Officer — DPDP requires a named point of contact */}
      <section
        id="grievance-officer"
        className="rounded-2xl border border-primary/20 bg-primary/5 p-6"
      >
        <h2 className="text-title font-semibold text-foreground">Grievance Officer</h2>
        <p className="mt-2 text-body leading-relaxed text-muted-foreground">
          For any question, concern or complaint about how your personal data is handled, contact:
        </p>
        <dl className="mt-4 space-y-2 text-body">
          <div className="flex flex-wrap gap-x-3">
            <dt className="w-16 shrink-0 text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{officer.name}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="w-16 shrink-0 text-muted-foreground">Email</dt>
            <dd>
              <a
                href={`mailto:${officer.email}`}
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
              >
                <Mail className="size-3.5" />
                {officer.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="w-16 shrink-0 text-muted-foreground">Entity</dt>
            <dd className="text-foreground">
              {COMPANY.legal} ({COMPANY.brand}), {COMPANY.city}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-detail leading-relaxed text-muted-foreground">
          We acknowledge every grievance and aim to resolve it within 30 days. If we cannot, we
          will tell you why and what happens next.
        </p>
      </section>

      <Section title="Children">
        <p>
          Our services are for adults. We do not knowingly collect personal data from anyone under
          18 without a parent or guardian&rsquo;s verifiable consent. Guest lists uploaded by a host
          may include family members of any age; we use them only to send that event&rsquo;s
          invitations.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access to personal data inside {COMPANY.brand} is limited to staff who need it for their
          role, is logged, and is protected by encrypted connections and password-protected
          accounts. If a breach ever affects your data, we will inform you and the Data Protection
          Board as the DPDP Act requires.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as our services or the law change. The date at the top shows
          the current version; material changes will be announced on this page.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-title font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-copy leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
