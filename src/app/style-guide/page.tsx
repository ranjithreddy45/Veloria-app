"use client";

// ============================================================
// /style-guide (Spec C) — a public showcase of the design foundation: the
// module chip and page header, action pills, KPI tiles, the module registry,
// and the Projects kit, rendered with local/mock state (no server actions
// fire, and the demo pills are plain buttons that navigate nowhere). Used for
// visual QA across desktop / tablet / mobile and dark mode.
//
// It is also a test fixture: the header/skeleton pairs (HEADER_PAIRS) are
// where tests/e2e/header-geometry.spec.ts checks that PageHeaderSkeleton's
// title box lands where PageHeader's h1 does. The route is public (no
// middleware gate), so that check needs no session and no database rows.
//
// Nothing here restates a colour: the chips and the module list are drawn
// from src/config/modules.ts and src/lib/ui/hues.ts (through IconChip), so
// this page cannot drift from the app.
// ============================================================

import * as React from "react";
import { Check, Inbox, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Donut } from "@/components/ui/donut";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { IndianRupee, CalendarCheck, Users, Trophy, Target, Flame } from "lucide-react";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";
import { IconChip } from "@/components/ui/icon-chip";
import { QuickActionButton, QuickActions } from "@/components/ui/quick-actions";
import { MODULES, MODULE_KEYS } from "@/config/modules";
import { ViewTabs } from "@/components/ui/view-tabs";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/kanban-board";
import { LayoutList, Kanban as KanbanIcon, CalendarDays } from "lucide-react";
import { WorkflowStepper, type Step } from "@/app/(dashboard)/projects/_components/workflow-stepper";
import { CategorySection, ChecklistItem, ChecklistHeader, type ChecklistFilter } from "@/app/(dashboard)/projects/_components/checklist-kit";
import { phaseHue, readinessTone, type ChecklistTone } from "@/lib/projects/ui";

const STAGES: Step[] = [
  { key: "HANDOFF", label: "Handoff Received", status: "complete" },
  { key: "ASSESSMENT", label: "Assessment & Scoping", status: "complete" },
  { key: "CAPEX", label: "CapEx & Timeline", status: "complete" },
  { key: "EXECUTION", label: "Execution / Fit-out", status: "current" },
  { key: "INTERNAL_QC", label: "Internal QC", status: "upcoming" },
  { key: "OPS_AUDIT", label: "Operations Audit", status: "upcoming" },
  { key: "FINAL_GO_AHEAD", label: "Final Go-Ahead", status: "upcoming" },
  { key: "HANDOVER", label: "Handover & Launch", status: "upcoming" },
  { key: "LIVE", label: "Live / Handed Over", status: "upcoming" },
];

const READINESS_OPTIONS: SegmentOption[] = [
  { value: "DONE", label: "Done", tone: "done" },
  { value: "PENDING", label: "Pending", tone: "pending" },
  { value: "NA", label: "N/A", tone: "na" },
];

const MOCK_ITEMS = [
  { id: "1", category: "Interiors", title: "Ceiling height & soffit clearance", description: "Minimum 14ft clear height across the main banquet floor; soffits and ducting boxed and finished to Veloria standard with no exposed services in guest sightlines.", status: "DONE" },
  { id: "2", category: "Interiors", title: "Flooring finish & level tolerance", description: "Vitrified / engineered flooring laid to a ±3mm level tolerance over 3m, polished, with skirting and expansion joints detailed.", status: "PENDING" },
  { id: "3", category: "Interiors", title: "Feature wall & cladding", description: "Signature feature wall installed and lit.", status: "NA" },
];

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h2>
      {note && <p className="max-w-2xl text-body leading-relaxed text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

// The three chip jobs, side by side. Each example is the real IconChip at the
// size and tone that job uses in the app; the module chips come from the
// registry, so a registry change shows up here too.
const BOOKINGS = MODULES.bookings;
const SITE_VISITS = MODULES["site-visits"];

const CHIP_JOBS: ReadonlyArray<{
  job: string;
  spec: string;
  rule: string;
  example: React.ReactNode;
}> = [
  {
    job: "Identity",
    spec: "Module chip · lg 40px · solid",
    rule: "One per page, in the header's title row. It comes from the route through the module registry, never from the page. Hidden below sm.",
    example: <IconChip icon={BOOKINGS.icon} hue={BOOKINGS.hue} size="lg" tone="solid" />,
  },
  {
    job: "Action",
    spec: "Pill chip · sm 28px · solid",
    rule: "Inside an action pill, showing the destination module's chip. On a module landing the primary pill carries an inverse Plus chip instead; on the /dashboard hub it carries its destination's glyph in that inverse chip.",
    example: <IconChip icon={SITE_VISITS.icon} hue={SITE_VISITS.hue} size="sm" tone="solid" />,
  },
  {
    job: "Metric",
    spec: "KPI chip · md 36px · tinted",
    rule: "Only on a KPI tile (the StatTile row above). Never solid, so a number never reads as an action or a module.",
    example: <IconChip icon={<IndianRupee className="size-4" />} hue="emerald" size="md" tone="soft" />,
  },
];

// Each PageHeader variant above the PageHeaderSkeleton a route's loading.tsx
// draws for it. tests/e2e/header-geometry.spec.ts measures these pairs at
// 1440px and 390px (the skeleton's title box must start where the h1 does,
// left and top within 2px), so the ids and data attributes are its contract:
// keep them, and add a pair there when you add one here.
//
// The two boxes of a pair are identical and stacked, so they are always the
// same width. Side by side, a column at 1440px is too narrow for the
// two-line pair's eyebrow to fit on one line, which is the state it has to
// show from sm up.
const PAIR_BOX = "rounded-2xl border border-border/60 bg-card/40 p-4";

const HEADER_PAIRS: ReadonlyArray<{
  id: string;
  label: string;
  header: React.ReactNode;
  skeleton: React.ReactNode;
}> = [
  {
    id: "eyebrow",
    label: "Own eyebrow · no actions",
    header: (
      <PageHeader
        title="Function sheets"
        eyebrow="Event Operations · Sheets"
        description="Banquet event orders for every confirmed function."
        module="beo"
      />
    ),
    skeleton: <PageHeaderSkeleton />,
  },
  {
    id: "module-eyebrow",
    label: "No eyebrow passed, so PageHeader's default from the module registry · no actions",
    header: <PageHeader title="Invoices" description="GST invoices, balances and reminders." module="invoices" />,
    skeleton: <PageHeaderSkeleton />,
  },
  {
    id: "actions-meta",
    label: "Action cluster and a meta row",
    header: (
      <PageHeader
        title="Enquiries"
        eyebrow="Sales & CRM · Enquiry"
        description="Every walk-in, call and web enquiry before it becomes a lead."
        module="contacts"
        actions={
          <QuickActions
            leading={<QuickActionButton variant="primary" label="Add enquiry" hint="Log a walk-in" />}
          />
        }
      >
        <span className="text-detail text-muted-foreground">The meta row: links and notes under the description.</span>
      </PageHeader>
    ),
    skeleton: <PageHeaderSkeleton actions={1} meta />,
  },
  {
    // Two items that together overflow a phone column (308px here) while each
    // fits in one, so the eyebrow is exactly two lines at 390px with any
    // likely UI font (the body stack falls through to system-ui on Linux CI),
    // and one line from sm up.
    id: "two-line-eyebrow",
    label: "Eyebrow of counts, two lines on a phone · action cluster",
    header: (
      <PageHeader
        title="Bookings"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Operations · Event calendar</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">128</span> total ·{" "}
              <span className="font-semibold tabular-nums">96</span> confirmed
            </span>
          </div>
        }
        description="Every event across the pipeline, at a glance."
        module="bookings"
        actions={<QuickActions leading={<QuickActionButton variant="primary" label="Book a date" hint="Hold a slot" />} />}
      />
    ),
    skeleton: <PageHeaderSkeleton actions={1} eyebrowLines={2} />,
  },
];

type BoardCard = { id: string; title: string; when: string; pax: number; amount: string; tag?: string; tagHue?: Hue };
const BOARD_COLUMNS: KanbanColumn<BoardCard>[] = [
  { id: "new", label: "New enquiry", hue: "blue", items: [
    { id: "1", title: "Sharma–Kapoor Wedding", when: "18 Aug", pax: 450, amount: "₹12.5L", tag: "Wedding", tagHue: "pink" },
    { id: "2", title: "Infosys Corporate Offsite", when: "02 Sep", pax: 120, amount: "₹4.2L", tag: "Corporate", tagHue: "blue" },
  ] },
  { id: "visit", label: "Site visit", hue: "cyan", items: [
    { id: "3", title: "Reddy Reception", when: "Tomorrow, 4 PM", pax: 300, amount: "₹9.8L", tag: "Grand Hall", tagHue: "indigo" },
  ] },
  { id: "quote", label: "Quotation", hue: "amber", items: [
    { id: "4", title: "Mehta Sangeet", when: "Quote #Q-2048", pax: 250, amount: "₹16.0L", tag: "Awaiting approval", tagHue: "amber" },
  ] },
  { id: "booked", label: "Booked", hue: "emerald", items: [
    { id: "5", title: "Iyer Wedding", when: "24 Aug · Grand Hall", pax: 500, amount: "₹22.0L", tag: "Advance paid", tagHue: "emerald" },
  ] },
];

export default function StyleGuidePage() {
  const [view, setView] = React.useState<"list" | "board" | "calendar">("board");
  const [seg, setSeg] = React.useState("DONE");
  const [filter, setFilter] = React.useState<ChecklistFilter>("all");
  const [open, setOpen] = React.useState(true);
  const [items, setItems] = React.useState(MOCK_ITEMS);

  function setStatus(id: string, status: string) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, status } : it)));
  }

  const done = items.filter((i) => readinessTone(i.status) === "done").length;
  const na = items.filter((i) => readinessTone(i.status) === "na").length;
  const pending = items.filter((i) => readinessTone(i.status) === "pending").length;
  const pct = Math.round(((done + na) / items.length) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <header>
        <h1 className="text-h2 font-semibold">Design foundation</h1>
        <p className="text-copy text-muted-foreground">The page header and its loading skeleton, module chips, action pills and KPI tiles, plus the Projects kit (Workflow stepper and Readiness checklist).</p>
      </header>

      <Section
        title="Workspace kit — page header · actions · view tabs · board"
        note={
          <>
            The header&rsquo;s chip comes from the module registry: a real page gets it from its route, and this demo
            forces <code className="font-mono text-detail">module=&quot;bookings&quot;</code>. The action cluster sits right
            of the title and wraps below it when there is no room. With actions present, other controls such as view tabs
            move to a row under the description.
          </>
        }
      >
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
          <PageHeader
            title="Bookings"
            description="Every event across the pipeline, at a glance."
            eyebrow="Sales & CRM"
            module="bookings"
            actions={
              <QuickActions
                leading={<QuickActionButton variant="primary" label="New booking" hint="Add a booking" />}
              />
            }
          >
            <ViewTabs
              value={view}
              onValueChange={setView}
              options={[
                { value: "list", label: "List", icon: LayoutList },
                { value: "board", label: "Board", icon: KanbanIcon },
                { value: "calendar", label: "Calendar", icon: CalendarDays },
              ]}
            />
          </PageHeader>
          <KanbanBoard
            columns={BOARD_COLUMNS}
            getKey={(c) => c.id}
            renderCard={(c) => (
              <div className="space-y-2">
                <p className="text-body font-semibold leading-snug">{c.title}</p>
                <p className="text-meta text-muted-foreground">{c.when} · {c.pax} pax</p>
                <div className="flex items-center justify-between gap-2">
                  {c.tag ? <StatusPill label={c.tag} hue={c.tagHue} size="xs" /> : <span />}
                  <span className="text-detail font-bold tabular-nums">{c.amount}</span>
                </div>
              </div>
            )}
          />
        </div>
      </Section>

      <Section
        title="Loading skeleton — PageHeader over its PageHeaderSkeleton"
        note={
          <>
            Each pair is a real PageHeader above the PageHeaderSkeleton that a route&rsquo;s{" "}
            <code className="font-mono text-detail">loading.tsx</code> draws for it, in identical boxes. When the page
            replaces the skeleton the title must not move, so the skeleton&rsquo;s title box starts where the h1 does at
            every width: same left, same top.
          </>
        }
      >
        <div className="space-y-6">
          {HEADER_PAIRS.map((pair) => (
            <figure key={pair.id} data-header-pair={pair.id} className="space-y-2">
              <figcaption className="text-meta font-medium text-muted-foreground">{pair.label}</figcaption>
              <div data-pair-part="header" className={PAIR_BOX}>
                {pair.header}
              </div>
              <div data-pair-part="skeleton" className={PAIR_BOX}>
                {pair.skeleton}
              </div>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="KPI tiles (StatTile)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Revenue (MTD)" value="₹18.4L" accent="emerald" icon={<IndianRupee className="size-4" />} trend={{ text: "+12% vs last month", tone: "up" }} />
          <StatTile label="Bookings" value="34" accent="blue" icon={<CalendarCheck className="size-4" />} sub="6 this week" />
          <StatTile label="Goal progress" value="72%" accent="gold" icon={<Target className="size-4" />} pct={72} />
          <StatTile label="Day streak" value="9" accent="amber" icon={<Flame className="size-4" />} sub="Keep it going!" />
          <StatTile label="Team Velos" value="1,240" accent="pink" icon={<Trophy className="size-4" />} pct={88} />
          <StatTile label="New leads" value="21" accent="cyan" icon={<Users className="size-4" />} delta={-3} />
          <StatTile label="On-time %" value="94%" accent="teal" icon={<Target className="size-4" />} pct={94} />
          <StatTile label="At risk" value="2" accent="rose" icon={<Flame className="size-4" />} sub="Needs attention" />
        </div>
      </Section>

      <Section
        title="Chips — identity · action · metric"
        note="Solid means identity or action; tinted means a metric. Each job has its own size, so two kinds of chip never share a shape on one screen."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {CHIP_JOBS.map((c) => (
            <Card key={c.job} data-chip-job={c.job.toLowerCase()} className="gap-2 p-4">
              <div className="flex h-10 items-center">{c.example}</div>
              <p className="text-copy font-semibold leading-tight text-foreground">{c.job}</p>
              <p className="text-meta font-medium text-muted-foreground">{c.spec}</p>
              <p className="text-body leading-relaxed text-muted-foreground">{c.rule}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-muted-foreground">In a pill:</span>
          <QuickActionButton label="Schedule site visit" hint="Book a show-around" module="site-visits" />
        </div>
      </Section>

      <Section
        title="Module registry — one glyph and hue per module"
        note={
          <>
            Generated from <code className="font-mono text-detail">src/config/modules.ts</code>. A module wears the same
            chip on its landing, its record pages, its forms and on any pill that links to it. Plum is reserved for the
            primary action and rose/red for states, so none of them is a module hue.
          </>
        }
      >
        {/* One Card panel holding plain list rows: a row has no border or fill
            of its own, so it never reads as a (clickable) action pill. */}
        <Card className="gap-0 p-2">
          <ul role="list" aria-label="Module registry" className="grid gap-x-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_KEYS.map((key) => {
              const mod = MODULES[key];
              return (
                <li
                  key={key}
                  data-module={key}
                  data-hue={mod.hue}
                  className="flex min-w-0 items-center gap-2.5 px-2 py-2"
                >
                  <IconChip icon={mod.icon} hue={mod.hue} size="sm" tone="solid" />
                  <span className="min-w-0">
                    <span className="block text-detail font-semibold leading-tight text-foreground">{mod.label}</span>
                    <span className="block break-words text-meta leading-tight text-muted-foreground">
                      {mod.hue} · {mod.prefixes.join(" ")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>

      <Section title="Donut · health bands">
        <div className="flex items-center gap-6">
          <Donut value={18} colorClass="text-rose-500" />
          <Donut value={55} colorClass="text-amber-500" />
          <Donut value={88} colorClass="text-emerald-500" />
          <Donut value={100} size={64} thickness={6} colorClass="text-emerald-500" />
        </div>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          options={READINESS_OPTIONS}
          value={seg}
          onChange={setSeg}
          ariaLabel="Demo status"
        />
      </Section>

      <Section
        title="StatusPill · phase hues"
        note="Status hues describe a record's state, drawn here with the same phaseHue() the Projects pages use. They are a separate palette from the module chips above and never mark a module."
      >
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <StatusPill key={s.key} label={s.label} hue={phaseHue(s.key)} size="sm" />
          ))}
        </div>
      </Section>

      <Section title="WorkflowStepper (Spec A)">
        <WorkflowStepper stages={STAGES} currentIndex={3} gateMessage="52 readiness items still open — every standard must pass (or be N/A) before Internal QC." />
      </Section>

      <Section title="Readiness checklist (Spec B) — kit pieces">
        <ChecklistHeader
          title="Ready" pct={pct} done={done} pending={pending} na={na}
          gateMessage="Clear all pending standards to move to Internal QC."
          filter={filter} onFilter={setFilter} allOpen={open} onToggleAll={() => setOpen((v) => !v)}
        />
        <CategorySection name="Interiors" done={done} total={items.length} pct={pct} open={open} onToggle={() => setOpen((v) => !v)}>
          {items.map((it) => (
            <ChecklistItem
              key={it.id}
              item={it}
              tone={readinessTone(it.status) as ChecklistTone}
              options={READINESS_OPTIONS}
              onChange={(v) => setStatus(it.id, v)}
              badge={it.id === "1" ? <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-meta font-semibold uppercase text-rose-600"><ShieldAlert className="size-3" /> critical</span> : undefined}
            />
          ))}
        </CategorySection>
      </Section>

      <Section title="EmptyState">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="gap-0 py-0"><EmptyState tone="success" icon={<Check className="size-5" />} title="Nothing pending" description="Every standard has been signed off." /></Card>
          <Card className="gap-0 py-0"><EmptyState icon={<Inbox className="size-5" />} title="No items match this filter" /></Card>
        </div>
      </Section>
    </div>
  );
}
