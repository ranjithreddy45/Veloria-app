"use client";

import * as React from "react";
import { HelpHint } from "@/components/layout/help-hint";

// ============================================================
// Central help-copy registry for every feature page.
// Add a "?" next to a page title with:  <PageHelp id="invoices" />
//
// Each entry mirrors the depth of the Lead hint: 2–3 short
// paragraphs of plain English written for the Veloria Grand team
// (a banquet / event business), ending with a "Rule of thumb".
// ============================================================

interface HelpEntry {
  title: string;
  body: React.ReactNode;
}

// A normal explanatory paragraph.
const p = (children: React.ReactNode) => <p>{children}</p>;
// The muted "Rule of thumb" line, matching the Lead hint styling.
const rule = (children: React.ReactNode) => (
  <p className="text-foreground/70">{children}</p>
);

export const PAGE_HELP: Record<string, HelpEntry> = {
  // ---- Sales CRM ----
  approvals: {
    title: "What are Approvals?",
    body: (
      <>
        {p(<>An <strong>Approval</strong> is an internal sign-off. When a quote, deal, or booking crosses a rule you&rsquo;ve set (e.g. a discount above 20%, or a deal over ₹15&nbsp;lakh), it&rsquo;s held here and routed to the right manager to <strong>Approve, Reject, or Delegate</strong> before it can go out or proceed.</>)}
        {p(<>This page is your personal queue: <strong>Pending</strong> shows requests waiting on you; Approved, Rejected, and All are your history. Set the thresholds and approver chains in Settings → Approval Rules.</>)}
        {rule(<>Rule of thumb: Approvals are the &ldquo;are you sure?&rdquo; checkpoint that stops big discounts or risky bookings slipping through without a manager&rsquo;s nod.</>)}
      </>
    ),
  },
  quotes: {
    title: "What is a Quote?",
    body: (
      <>
        {p(<>A <strong>Quote</strong> is a priced proposal you send a client for a specific event — line items, a discount, tax, and a total. It starts as a <strong>Draft</strong> you can edit freely.</>)}
        {p(<>Once it looks right you send it; if the client accepts, you convert it into an <strong>Invoice</strong> to collect payment. A heavily discounted quote needs a manager&rsquo;s approval before it can be sent.</>)}
        {rule(<>Rule of thumb: a Quote is the &ldquo;here&rsquo;s the price&rdquo; document — it grows out of a Lead/Deal and becomes an Invoice once accepted.</>)}
      </>
    ),
  },
  contracts: {
    title: "What is a Contract?",
    body: (
      <>
        {p(<>A <strong>Contract</strong> is the formal agreement for a booking — the terms, the agreed amount, and the signatures that make it binding.</>)}
        {p(<>Generate one from a reusable template, send it to the client for sign-off, and track whether it&rsquo;s draft, sent, or signed. It&rsquo;s tied to the booking it covers.</>)}
        {rule(<>Rule of thumb: the Quote agrees the price; the Contract makes it official.</>)}
      </>
    ),
  },
  inquiries: {
    title: "What are Widget Inquiries?",
    body: (
      <>
        {p(<>These are raw enquiries captured automatically from your website widget and web forms — before anyone has worked them.</>)}
        {p(<>Review each one and turn it into a <strong>Lead</strong> (an enquiry attached to a Contact) so it enters your sales pipeline and gets followed up.</>)}
        {rule(<>Rule of thumb: Inquiries are the unopened mailbox; Leads are what you get once you&rsquo;ve sorted and claimed them.</>)}
      </>
    ),
  },

  // ---- Bookings & Operations ----
  "bookings-calendar": {
    title: "What is the Booking Calendar?",
    body: (
      <>
        {p(<>A month and day view of every event across all your venues — confirmed bookings and tentative holds together.</>)}
        {p(<>Use it to spot free dates, avoid two functions clashing in the same hall, and see the day&rsquo;s line-up at a glance.</>)}
        {rule(<>Rule of thumb: the Bookings list tells you &ldquo;what&rdquo;; the Calendar tells you &ldquo;when and where it fits.&rdquo;</>)}
      </>
    ),
  },
  tasks: {
    title: "What are Tasks?",
    body: (
      <>
        {p(<>Tasks are your team&rsquo;s to-do items — follow-ups, prep work, and reminders — each with an owner, a due date, and a priority.</>)}
        {p(<>A task can stand alone (&ldquo;call the caterer&rdquo;) or be attached to a specific booking so event prep is tracked in one place. Overdue ones surface on the dashboard.</>)}
        {rule(<>Rule of thumb: if it needs doing and shouldn&rsquo;t be forgotten, make it a Task.</>)}
      </>
    ),
  },
  "task-templates": {
    title: "What are Task Templates?",
    body: (
      <>
        {p(<>A <strong>Task Template</strong> is a reusable checklist of tasks you apply to a booking in one click — for example a standard &ldquo;Wedding prep&rdquo; set covering decor, catering, and rehearsal.</>)}
        {p(<>It saves re-typing the same to-dos for every event and makes sure nothing is missed.</>)}
        {rule(<>Rule of thumb: if you do the same set of steps for every event of a type, build it once as a template.</>)}
      </>
    ),
  },
  vendors: {
    title: "What are Vendors?",
    body: (
      <>
        {p(<>Vendors are your external partners — caterers, decorators, photographers, DJs, and the like.</>)}
        {p(<>Keep their details here, assign them to events, collect their bids, pay them via Payouts, and rate their performance so you know who to rebook.</>)}
        {rule(<>Rule of thumb: anyone you hire in for an event is a Vendor.</>)}
      </>
    ),
  },
  resources: {
    title: "What are Resources?",
    body: (
      <>
        {p(<>Resources are bookable in-house assets — halls, lawns, equipment, and staff pools — that you allocate to events.</>)}
        {p(<>Tracking them here stops two functions from claiming the same space or kit on the same day.</>)}
        {rule(<>Rule of thumb: if it&rsquo;s yours and only one event can use it at a time, it&rsquo;s a Resource.</>)}
      </>
    ),
  },
  staff: {
    title: "What is Staff Scheduling?",
    body: (
      <>
        {p(<>Roster your team to events and shifts — see who&rsquo;s working when, and avoid double-booking the same person.</>)}
        {p(<>Plan coverage for busy dates so every event is properly staffed.</>)}
        {rule(<>Rule of thumb: this is the &ldquo;who&rsquo;s on duty&rdquo; board for your people.</>)}
      </>
    ),
  },
  "staff-payroll": {
    title: "What is Staff Payroll?",
    body: (
      <>
        {p(<>Hours, shift pay, and payout totals for your staff, calculated from their schedules.</>)}
        {p(<>Use it to settle wages accurately without re-counting shifts by hand.</>)}
        {rule(<>Rule of thumb: Scheduling decides who works; Payroll turns those shifts into what they&rsquo;re paid.</>)}
      </>
    ),
  },

  // ---- Catalog ----
  packages: {
    title: "What are Packages?",
    body: (
      <>
        {p(<>A <strong>Package</strong> is a pre-built event bundle — say a &ldquo;Silver Wedding Package&rdquo; combining venue, menu, and services at one set price.</>)}
        {p(<>They give your team a fast, consistent starting point when quoting, instead of pricing everything from scratch each time.</>)}
        {rule(<>Rule of thumb: Packages are your &ldquo;menu of deals&rdquo; that speed up quoting.</>)}
      </>
    ),
  },
  menu: {
    title: "What is the Menu?",
    body: (
      <>
        {p(<>Your catering dishes and items, with prices, organised by course and cuisine.</>)}
        {p(<>These feed the per-event menu builder and flow into quotes, so food pricing stays consistent.</>)}
        {rule(<>Rule of thumb: this is your master food catalogue; individual events pick from it.</>)}
      </>
    ),
  },
  pricing: {
    title: "What is the Pricing Engine?",
    body: (
      <>
        {p(<>Rules that adjust prices automatically — seasonal rates, weekend premiums, peak-date surcharges.</>)}
        {p(<>They make sure a quote reflects the right price for the date and conditions without anyone doing the maths.</>)}
        {rule(<>Rule of thumb: set the rules once here, and every quote prices itself correctly.</>)}
      </>
    ),
  },
  "rate-plans": {
    title: "What are Rate Plans?",
    body: (
      <>
        {p(<>A <strong>Rate Plan</strong> is a named set of base prices — like &ldquo;Peak Season&rdquo; or &ldquo;Off-Season&rdquo; — that you switch between.</>)}
        {p(<>Changing the active plan updates venue and package rates together, instead of editing each one by hand.</>)}
        {rule(<>Rule of thumb: Rate Plans are the big seasonal dial; the Pricing Engine is the fine-tuning on top.</>)}
      </>
    ),
  },
  inventory: {
    title: "What is Inventory?",
    body: (
      <>
        {p(<>Your consumable and reusable stock — crockery, linen, supplies — with the quantities you have on hand.</>)}
        {p(<>Reserve items against events and see what&rsquo;s running low before it becomes a problem.</>)}
        {rule(<>Rule of thumb: countable things you own and use up or reuse live in Inventory.</>)}
      </>
    ),
  },
  rentals: {
    title: "What are Equipment Rentals?",
    body: (
      <>
        {p(<>Items you rent out to clients or hire in for events — furniture, sound, lighting.</>)}
        {p(<>Track availability, rental periods, and which booking each item is tied to so nothing is over-committed.</>)}
        {rule(<>Rule of thumb: gear that comes and goes for a fee, in or out, is a Rental.</>)}
      </>
    ),
  },

  // ---- Finance ----
  invoices: {
    title: "What is an Invoice?",
    body: (
      <>
        {p(<>An <strong>Invoice</strong> is the bill you issue a client for a booking — what&rsquo;s due, what&rsquo;s been paid, and what&rsquo;s still outstanding.</>)}
        {p(<>Create one fresh or convert it from an accepted Quote; payments get recorded against it.</>)}
        {rule(<>Rule of thumb: the Quote proposes the price; the Invoice actually asks for the money.</>)}
      </>
    ),
  },
  payments: {
    title: "What are Payments?",
    body: (
      <>
        {p(<>Money received from clients against their invoices — advances, tokens, and final settlements — whether paid online (Razorpay) or entered manually.</>)}
        {p(<>These add up to your revenue figures and show how much of each invoice is still owed.</>)}
        {rule(<>Rule of thumb: every rupee that comes in gets logged here as a Payment.</>)}
      </>
    ),
  },
  payouts: {
    title: "What are Payouts?",
    body: (
      <>
        {p(<>Money you pay out to vendors and partners for their work on events.</>)}
        {p(<>Track what&rsquo;s owed and what&rsquo;s been settled so partners are paid correctly and on time.</>)}
        {rule(<>Rule of thumb: Payments are money coming in; Payouts are money going out to partners.</>)}
      </>
    ),
  },
  commissions: {
    title: "What are Commissions?",
    body: (
      <>
        {p(<>Earnings owed to your salespeople or referral partners on business they bring in, worked out from your commission rules.</>)}
        {p(<>Use it to see who has earned what and keep incentives fair and transparent.</>)}
        {rule(<>Rule of thumb: Commissions are the cut your people earn when a deal closes.</>)}
      </>
    ),
  },
  insurance: {
    title: "What are Insurance Policies?",
    body: (
      <>
        {p(<>Records of event and liability insurance — the coverage, its validity dates, and which bookings it protects.</>)}
        {p(<>Keeping them here makes sure high-value events are properly covered and nothing lapses.</>)}
        {rule(<>Rule of thumb: the safety net for big events lives here.</>)}
      </>
    ),
  },

  // ---- Marketing ----
  campaigns: {
    title: "What are Campaigns?",
    body: (
      <>
        {p(<>Marketing outreach — email or WhatsApp blasts to a segment of your contacts — to fill dates and promote offers.</>)}
        {p(<>Track who was reached and how they responded so you can see what actually drives bookings.</>)}
        {rule(<>Rule of thumb: Campaigns are how you go out and create new enquiries, rather than waiting for them.</>)}
      </>
    ),
  },
  loyalty: {
    title: "What is Loyalty & Rewards?",
    body: (
      <>
        {p(<>Reward repeat clients with points and perks to encourage them to book again and refer friends.</>)}
        {p(<>It turns one-time customers into regulars — valuable in a word-of-mouth business like events.</>)}
        {rule(<>Rule of thumb: Loyalty keeps your best clients coming back.</>)}
      </>
    ),
  },
  referrals: {
    title: "What are Referrals?",
    body: (
      <>
        {p(<>Track who sends new business your way and the rewards they&rsquo;ve earned for it.</>)}
        {p(<>Referred leads are tagged to the person who introduced them, so you can credit and thank the right people.</>)}
        {rule(<>Rule of thumb: Referrals turn happy clients and partners into a steady source of new leads.</>)}
      </>
    ),
  },

  // ---- Analytics ----
  reports: {
    title: "What are Reports & Analytics?",
    body: (
      <>
        {p(<>Ready-made reports on leads, bookings, revenue, and team activity — the headline numbers that show how the business is doing.</>)}
        {p(<>A quick, regular pulse-check without building anything yourself.</>)}
        {rule(<>Rule of thumb: start here for the &ldquo;how are we doing?&rdquo; answer.</>)}
      </>
    ),
  },
  analytics: {
    title: "What is Analytics?",
    body: (
      <>
        {p(<>Deeper, interactive dashboards and trends across sales and operations that you can slice and filter.</>)}
        {p(<>Where you go beyond the headline numbers to understand why they&rsquo;re moving.</>)}
        {rule(<>Rule of thumb: Reports tell you what happened; Analytics helps you dig into why.</>)}
      </>
    ),
  },
  budget: {
    title: "What are Budgets?",
    body: (
      <>
        {p(<>Targets you set for revenue or spending over a period, tracked against what actually happens.</>)}
        {p(<>They tell you at a glance whether you&rsquo;re ahead of or behind plan.</>)}
        {rule(<>Rule of thumb: a Budget is the goal line; actuals show how close you are to it.</>)}
      </>
    ),
  },
  forecast: {
    title: "What is the Revenue Forecast?",
    body: (
      <>
        {p(<>A projection of revenue from your pipeline and confirmed bookings, weighted by how likely each deal is to close.</>)}
        {p(<>It shows what&rsquo;s realistically coming so you can plan staffing and cash flow.</>)}
        {rule(<>Rule of thumb: the Forecast is your best estimate of money still to land.</>)}
      </>
    ),
  },
  performance: {
    title: "What is Performance?",
    body: (
      <>
        {p(<>Scorecards for your team and vendors — leads worked, deals won, response times — with leaderboards, badges, and incentives.</>)}
        {p(<>It turns everyday activity into a clear picture of who&rsquo;s delivering and motivates healthy competition.</>)}
        {rule(<>Rule of thumb: Performance is the &ldquo;who&rsquo;s doing well&rdquo; view across people and partners.</>)}
      </>
    ),
  },
  competitors: {
    title: "What is Competitor Analysis?",
    body: (
      <>
        {p(<>Notes and intel on rival venues — their pricing, strengths, and where you tend to win.</>)}
        {p(<>Gives your team talking points to position Veloria Grand confidently against the alternatives.</>)}
        {rule(<>Rule of thumb: know the competition so you can out-sell them.</>)}
      </>
    ),
  },
  surveys: {
    title: "What are Surveys & Feedback?",
    body: (
      <>
        {p(<>Questionnaires you send clients — usually after their event — to capture how it went.</>)}
        {p(<>The feedback flags what to improve and surfaces happy clients you can ask for reviews or referrals.</>)}
        {rule(<>Rule of thumb: Surveys are how you ask &ldquo;how did we do?&rdquo; systematically.</>)}
      </>
    ),
  },
  reviews: {
    title: "What are Reviews?",
    body: (
      <>
        {p(<>Client ratings and testimonials about their events — your social proof.</>)}
        {p(<>Good ones win new business; a poor one is an early warning to fix something fast.</>)}
        {rule(<>Rule of thumb: Reviews are what future clients trust most — collect and watch them.</>)}
      </>
    ),
  },

  // ---- Workspace ----
  documents: {
    title: "What are Documents?",
    body: (
      <>
        {p(<>A shared file library for the team — contracts, brochures, floor plans, and event paperwork in one place.</>)}
        {p(<>No more hunting through email or chat for the right file.</>)}
        {rule(<>Rule of thumb: if the team needs the same file, keep it in Documents.</>)}
      </>
    ),
  },
  gallery: {
    title: "What is the Gallery?",
    body: (
      <>
        {p(<>Your photo library of venues and past events.</>)}
        {p(<>These images power the guest-facing storefront and help your team show prospects exactly what you can deliver.</>)}
        {rule(<>Rule of thumb: great photos sell events — this is where they live.</>)}
      </>
    ),
  },
  notifications: {
    title: "What are Notifications?",
    body: (
      <>
        {p(<>Your alerts — assignments, approvals, reminders, and system updates — gathered in one feed.</>)}
        {p(<>It&rsquo;s how the system taps you on the shoulder so nothing important slips by.</>)}
        {rule(<>Rule of thumb: check here for &ldquo;what needs my attention right now.&rdquo;</>)}
      </>
    ),
  },

  // ---- Settings ----
  settings: {
    title: "What are Settings?",
    body: (
      <>
        {p(<>The control room where you configure the whole system — venues, pipeline stages, users, templates, automations, and integrations.</>)}
        {p(<>Mostly admin territory; changes here affect how the app works for everyone.</>)}
        {rule(<>Rule of thumb: set things up here once, and the rest of the app follows those rules.</>)}
      </>
    ),
  },
  venues: {
    title: "What are Venues?",
    body: (
      <>
        {p(<>Your event spaces, each with its capacity, base price, amenities, and photos.</>)}
        {p(<>Venues power availability checks, bookings, and the guest storefront — so getting them right matters everywhere.</>)}
        {rule(<>Rule of thumb: Venues are the foundation everything else (bookings, quotes, the storefront) is built on.</>)}
      </>
    ),
  },
  "pipeline-stages": {
    title: "What are Pipeline Stages?",
    body: (
      <>
        {p(<>The columns of your sales board — New Inquiry through to Event Executed — and the win probability attached to each.</>)}
        {p(<>Editing them changes how every deal flows, so they should mirror how you actually sell.</>)}
        {rule(<>Rule of thumb: these are the steps a deal walks through from &ldquo;just asking&rdquo; to &ldquo;booked.&rdquo;</>)}
      </>
    ),
  },
  workflows: {
    title: "What are Workflows?",
    body: (
      <>
        {p(<>Automations that fire on a trigger — for example, &ldquo;when a lead is created, send a welcome email and create a follow-up task.&rdquo;</>)}
        {p(<>They handle routine work for you so the team can focus on clients instead of admin.</>)}
        {rule(<>Rule of thumb: anything repetitive and rule-based, let a Workflow do it.</>)}
      </>
    ),
  },
  "email-templates": {
    title: "What are Email Templates?",
    body: (
      <>
        {p(<>Reusable, branded email layouts with merge fields like the client&rsquo;s name and event date.</>)}
        {p(<>Used by automations and one-off sends so every email looks professional and consistent.</>)}
        {rule(<>Rule of thumb: write it well once, reuse it everywhere.</>)}
      </>
    ),
  },
  "contract-templates": {
    title: "What are Contract Templates?",
    body: (
      <>
        {p(<>Reusable contract layouts with merge fields, so generating a client agreement is one click rather than a rewrite.</>)}
        {p(<>Keeps your terms consistent and legally tidy across every booking.</>)}
        {rule(<>Rule of thumb: the master agreement you stamp out for each event.</>)}
      </>
    ),
  },
  users: {
    title: "What is User Management?",
    body: (
      <>
        {p(<>Your team&rsquo;s accounts — who has access, their role, and what they&rsquo;re allowed to do.</>)}
        {p(<>Roles control which features each person sees, keeping sensitive areas (like finance) to the right people.</>)}
        {rule(<>Rule of thumb: add a teammate here and their role decides the rest.</>)}
      </>
    ),
  },
  blueprints: {
    title: "What are Blueprints?",
    body: (
      <>
        {p(<>Guided, enforced processes that control how a record moves from stage to stage — with required fields and actions at each step.</>)}
        {p(<>They keep the whole team following the same playbook instead of cutting corners.</>)}
        {rule(<>Rule of thumb: Workflows automate in the background; Blueprints guide people through the right steps on screen.</>)}
      </>
    ),
  },
  "escalation-rules": {
    title: "What are Escalation Rules?",
    body: (
      <>
        {p(<>Rules that flag or reassign work when it stalls — for example, an untouched lead after 24 hours.</>)}
        {p(<>They make sure nothing goes cold because someone got busy.</>)}
        {rule(<>Rule of thumb: the safety net that catches dropped balls before a client notices.</>)}
      </>
    ),
  },
  "referral-rules": {
    title: "What are Referral Reward Rules?",
    body: (
      <>
        {p(<>Define what referrers earn and the conditions that trigger it — turning a referred booking into a reward.</>)}
        {p(<>Set these once and the Referrals feature credits people automatically.</>)}
        {rule(<>Rule of thumb: the rulebook behind your referral rewards.</>)}
      </>
    ),
  },
  "approval-rules": {
    title: "What are Approval Rules?",
    body: (
      <>
        {p(<>The conditions that force a sign-off — discounts over 20%, deals above ₹15&nbsp;lakh — and the chain of approvers each request must clear.</>)}
        {p(<>They&rsquo;re what makes the Approvals queue actually trigger.</>)}
        {rule(<>Rule of thumb: set the &ldquo;when does a manager need to say yes?&rdquo; rules here.</>)}
      </>
    ),
  },
  "sop-templates": {
    title: "What are SOP Templates?",
    body: (
      <>
        {p(<>Standard operating procedures — step-by-step checklists for running events the same high-quality way every time.</>)}
        {p(<>They capture how your best events are delivered so any team member can repeat it.</>)}
        {rule(<>Rule of thumb: your &ldquo;how we do things&rdquo; playbooks, written down.</>)}
      </>
    ),
  },
  webforms: {
    title: "What are Webforms?",
    body: (
      <>
        {p(<>Embeddable enquiry forms for your website.</>)}
        {p(<>Submissions flow straight into the CRM as leads/inquiries, so no enquiry is lost in an inbox.</>)}
        {rule(<>Rule of thumb: Webforms are the front door on your website that feeds your pipeline.</>)}
      </>
    ),
  },
  integrations: {
    title: "What are Integrations?",
    body: (
      <>
        {p(<>Connections to outside services — payments (Razorpay), WhatsApp, email, calendar, telephony, accounting.</>)}
        {p(<>They let the CRM work hand-in-hand with the tools you already use.</>)}
        {rule(<>Rule of thumb: plug your other tools in here so everything talks to one another.</>)}
      </>
    ),
  },
  "activity-log": {
    title: "What is the Activity Log?",
    body: (
      <>
        {p(<>A running record of who did what and when across the system.</>)}
        {p(<>Useful for accountability and for tracing exactly when something changed.</>)}
        {rule(<>Rule of thumb: the system&rsquo;s memory — check it when you need to know &ldquo;who changed this?&rdquo;</>)}
      </>
    ),
  },
  trash: {
    title: "What is Trash?",
    body: (
      <>
        {p(<>Recently deleted records, kept for 30 days before they&rsquo;re permanently removed.</>)}
        {p(<>It means an accidental delete can be undone instead of lost forever.</>)}
        {rule(<>Rule of thumb: deleted by mistake? It&rsquo;s recoverable here for 30 days.</>)}
      </>
    ),
  },
  "notification-settings": {
    title: "What are Notification Settings?",
    body: (
      <>
        {p(<>Choose which alerts you get and how — in-app, email, or SMS/WhatsApp.</>)}
        {p(<>Tune it so you&rsquo;re notified about what matters, the way you prefer, without the noise.</>)}
        {rule(<>Rule of thumb: set your own &ldquo;tap me on the shoulder when&hellip;&rdquo; preferences here.</>)}
      </>
    ),
  },
};

export function PageHelp({ id }: { id: string }) {
  const entry = PAGE_HELP[id];
  if (!entry) return null;
  return <HelpHint title={entry.title}>{entry.body}</HelpHint>;
}
