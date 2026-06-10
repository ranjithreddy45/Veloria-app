"use client";

import * as React from "react";
import { HelpHint } from "@/components/layout/help-hint";

// ============================================================
// Central help-copy registry for every feature page.
// Add a "?" next to a page title with:  <PageHelp id="invoices" />
// Keep copy plain-English, 1–3 short paragraphs, written for the
// Veloria Grand team (a banquet / event business), not engineers.
// ============================================================

interface HelpEntry {
  title: string;
  body: React.ReactNode;
}

const p = (children: React.ReactNode, key?: React.Key) => <p key={key}>{children}</p>;

export const PAGE_HELP: Record<string, HelpEntry> = {
  // ---- Sales CRM ----
  approvals: {
    title: "What are Approvals?",
    body: (
      <>
        {p("Sign-off requests routed to you. When a quote, deal, or booking trips an approval rule (e.g. a discount over 20%), it lands here for you to Approve, Reject, or Delegate.")}
        {p("Set the thresholds and approver chains under Settings → Approval Rules.")}
      </>
    ),
  },
  quotes: {
    title: "What are Quotes?",
    body: (
      <>
        {p("Priced proposals you send to a client — line items, discount, tax, and a total. A quote starts as a Draft; once sent and accepted you convert it to an Invoice.")}
        {p("High-discount quotes require internal approval before they can be sent.")}
      </>
    ),
  },
  contracts: {
    title: "What are Contracts?",
    body: p("Formal agreements for a booking — terms, signatures, and the agreed amount. Generate one from a contract template, share it for sign-off, and track its status."),
  },
  inquiries: {
    title: "What are Widget Inquiries?",
    body: p("Raw enquiries captured from your website widget / web forms before they're worked. Review each one and convert it into a Lead (an enquiry attached to a contact)."),
  },

  // ---- Bookings & Operations ----
  "bookings-calendar": {
    title: "Booking Calendar",
    body: p("A month/day view of every confirmed and held event across your venues. Use it to spot free dates, avoid clashes, and see the day's line-up at a glance."),
  },
  tasks: {
    title: "What are Tasks?",
    body: p("Your team's to-do list — follow-ups, prep work, and reminders, each with an owner, due date, and priority. Tasks can be standalone or attached to a specific booking."),
  },
  "task-templates": {
    title: "Task Templates",
    body: p("Reusable checklists of tasks you apply to a booking in one click — e.g. a standard 'Wedding prep' set — so nothing is forgotten event to event."),
  },
  vendors: {
    title: "What are Vendors?",
    body: p("Your external partners — caterers, decorators, photographers, DJs. Track their details, assign them to events, collect bids, and rate their performance."),
  },
  resources: {
    title: "What are Resources?",
    body: p("Bookable in-house assets — halls, lawns, equipment, staff pools — that you allocate to events so two functions never claim the same thing."),
  },
  staff: {
    title: "Staff Scheduling",
    body: p("Roster your team to events and shifts — see who's working when, avoid double-booking people, and plan coverage for busy dates."),
  },
  "staff-payroll": {
    title: "Staff Payroll",
    body: p("Hours, shift pay, and payout totals for your staff — derived from their schedules so you can settle wages accurately."),
  },

  // ---- Catalog ----
  packages: {
    title: "What are Packages?",
    body: p("Pre-built event bundles (e.g. 'Silver Wedding Package') combining venue, menu, and services at a set price — a fast starting point when quoting a client."),
  },
  menu: {
    title: "What is the Menu?",
    body: p("Your catering dishes and menu items with prices, organised by course and cuisine. These feed into per-event menu builders and quotes."),
  },
  pricing: {
    title: "Pricing Engine",
    body: p("Rules that adjust prices automatically — seasonal rates, weekend premiums, peak-date surcharges — so quotes reflect the right price without manual maths."),
  },
  "rate-plans": {
    title: "Rate Plans",
    body: p("Named sets of base prices (e.g. 'Peak Season', 'Off-Season') you switch between, so venue and package rates update together."),
  },
  inventory: {
    title: "What is Inventory?",
    body: p("Consumable and reusable stock — crockery, linen, supplies — with quantities on hand. Reserve items against events and track what's running low."),
  },
  rentals: {
    title: "Equipment Rentals",
    body: p("Items you rent out or hire in for events (furniture, sound, lighting). Track availability, rental periods, and which booking each item is tied to."),
  },

  // ---- Finance ----
  invoices: {
    title: "What are Invoices?",
    body: p("Bills issued to clients for a booking — what's due, what's paid, and what's outstanding. Created fresh or converted from an accepted quote."),
  },
  payments: {
    title: "What are Payments?",
    body: p("Money received against invoices — advances, tokens, and final settlements — including online (Razorpay) and manual entries. Drives your revenue figures."),
  },
  payouts: {
    title: "What are Payouts?",
    body: p("Money you pay out to vendors and partners for their work on events — track what's owed and what's settled."),
  },
  commissions: {
    title: "What are Commissions?",
    body: p("Earnings owed to salespeople or referral partners on booked business, calculated from your commission rules."),
  },
  insurance: {
    title: "Insurance Policies",
    body: p("Event and liability insurance records — coverage, validity, and which bookings they protect — so high-value events are covered."),
  },

  // ---- Marketing ----
  campaigns: {
    title: "What are Campaigns?",
    body: p("Marketing outreach — email/WhatsApp blasts to segments of your contacts — to fill dates and promote offers. Track who was reached and how they responded."),
  },
  loyalty: {
    title: "Loyalty & Rewards",
    body: p("Reward repeat clients with points and perks to encourage them to book again and refer others."),
  },
  referrals: {
    title: "What are Referrals?",
    body: p("Track who refers new business to you and the rewards they've earned. Referred leads are tagged so you can credit the right person."),
  },

  // ---- Analytics ----
  reports: {
    title: "Reports & Analytics",
    body: p("Ready-made reports on leads, bookings, revenue, and team activity — the numbers that tell you how the business is doing."),
  },
  analytics: {
    title: "What is Analytics?",
    body: p("Deeper, interactive dashboards and trends across your sales and operations — slice the data to spot what's working and what isn't."),
  },
  budget: {
    title: "What are Budgets?",
    body: p("Targets you set for revenue or spend over a period, tracked against actuals so you can see if you're on plan."),
  },
  forecast: {
    title: "Revenue Forecast",
    body: p("A projection of revenue from your pipeline and confirmed bookings — weighted by win probability — so you can see what's likely to land."),
  },
  performance: {
    title: "What is Performance?",
    body: p("Scorecards for your team and vendors — leads worked, deals won, response times — with leaderboards, badges, and incentives to drive results."),
  },
  competitors: {
    title: "Competitor Analysis",
    body: p("Notes and intel on rival venues — pricing, strengths, and where you win — so your team can position Veloria Grand effectively."),
  },
  surveys: {
    title: "Surveys & Feedback",
    body: p("Questionnaires sent to clients (usually post-event) to capture satisfaction and feedback you can act on."),
  },
  reviews: {
    title: "What are Reviews?",
    body: p("Client ratings and testimonials about their events — your social proof, and an early warning when something needs fixing."),
  },

  // ---- Workspace ----
  documents: {
    title: "What are Documents?",
    body: p("A shared file library — contracts, brochures, floor plans, and event paperwork — kept in one place for the team."),
  },
  gallery: {
    title: "What is the Gallery?",
    body: p("Your photo library of venues and past events — used on the guest storefront and for showing prospects what you can deliver."),
  },
  notifications: {
    title: "Notifications",
    body: p("Your alerts — assignments, approvals, reminders, and system updates — so nothing important slips by."),
  },

  // ---- Settings ----
  settings: {
    title: "Settings",
    body: p("Where you configure the whole system — venues, pipeline stages, users, templates, automations, and integrations. Mostly admin territory."),
  },
  venues: {
    title: "What are Venues?",
    body: p("Your event spaces with their capacity, base price, amenities, and photos. Venues power availability checks, bookings, and the guest storefront."),
  },
  "pipeline-stages": {
    title: "Pipeline Stages",
    body: p("The columns of your sales Kanban (New Inquiry → … → Event Executed) and their win probabilities. Edit these to match how you actually sell."),
  },
  workflows: {
    title: "What are Workflows?",
    body: p("Automations that run on triggers — e.g. 'when a lead is created, send a welcome email and create a follow-up task' — so routine work happens by itself."),
  },
  "email-templates": {
    title: "Email Templates",
    body: p("Reusable, branded email layouts with merge fields (client name, event date) used by automations and one-off sends."),
  },
  "contract-templates": {
    title: "Contract Templates",
    body: p("Reusable contract layouts with merge fields, so generating a client agreement for a booking is one click, not a rewrite."),
  },
  users: {
    title: "User Management",
    body: p("Your team's accounts — who has access, their role, and what they're allowed to do. Roles control which features each person sees."),
  },
  blueprints: {
    title: "What are Blueprints?",
    body: p("Guided, enforced processes that control how a record moves stage to stage — with required fields and actions at each step — to keep the team consistent."),
  },
  "escalation-rules": {
    title: "Escalation Rules",
    body: p("Rules that flag or reassign work when it stalls — e.g. an untouched lead after 24 hours — so nothing goes cold."),
  },
  "referral-rules": {
    title: "Referral Reward Rules",
    body: p("Define what referrers earn and when — the conditions that turn a referred booking into a reward."),
  },
  "approval-rules": {
    title: "Approval Rules",
    body: p("Conditions that force a sign-off — e.g. discounts over 20%, deals above ₹15L — and the chain of approvers each request follows before proceeding."),
  },
  "sop-templates": {
    title: "SOP Templates",
    body: p("Standard operating procedures — step-by-step checklists for running events consistently every time."),
  },
  webforms: {
    title: "What are Webforms?",
    body: p("Embeddable enquiry forms for your website. Submissions flow in as leads/inquiries automatically, captured straight into the CRM."),
  },
  integrations: {
    title: "What are Integrations?",
    body: p("Connections to outside services — payments (Razorpay), WhatsApp, email, calendar, telephony, accounting — that plug into the CRM."),
  },
  "activity-log": {
    title: "Activity Log",
    body: p("A running audit trail of who did what and when across the system — useful for accountability and tracing changes."),
  },
  trash: {
    title: "What is Trash?",
    body: p("Recently deleted records, kept for 30 days before they're permanently purged — so an accidental delete can be restored."),
  },
  "notification-settings": {
    title: "Notification Settings",
    body: p("Choose which alerts you receive and how (in-app, email, SMS/WhatsApp), so you're notified the way you prefer."),
  },
};

export function PageHelp({ id }: { id: string }) {
  const entry = PAGE_HELP[id];
  if (!entry) return null;
  return <HelpHint title={entry.title}>{entry.body}</HelpHint>;
}
