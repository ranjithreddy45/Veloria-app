"use client";

// ============================================================
// /style-guide (Spec C) — a public showcase of the Projects-module design
// foundation: tokens, primitives, and the key composed components rendered
// with local/mock state (no server actions fire). Used for visual QA across
// desktop / tablet / mobile and dark mode.
// ============================================================

import * as React from "react";
import { Check, Inbox, ShieldAlert } from "lucide-react";
import { Donut } from "@/components/ui/donut";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { IndianRupee, CalendarCheck, Users, Trophy, Target, Flame } from "lucide-react";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { ViewTabs } from "@/components/ui/view-tabs";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/kanban-board";
import { LayoutList, Kanban as KanbanIcon, CalendarDays } from "lucide-react";
import { WorkflowStepper, type Step } from "@/app/(dashboard)/projects/_components/workflow-stepper";
import { CategorySection, ChecklistItem, ChecklistHeader, type ChecklistFilter } from "@/app/(dashboard)/projects/_components/checklist-kit";
import { readinessTone, type ChecklistTone } from "@/lib/projects/ui";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

type BoardCard = { id: string; title: string; when: string; pax: number; amount: string; tag?: string; tagHue?: Hue };
const BOARD_COLUMNS: KanbanColumn<BoardCard>[] = [
  { id: "new", label: "New enquiry", hue: "blue", items: [
    { id: "1", title: "Sharma–Kapoor Wedding", when: "18 Aug", pax: 450, amount: "₹12.5L", tag: "Wedding", tagHue: "pink" },
    { id: "2", title: "Infosys Corporate Offsite", when: "02 Sep", pax: 120, amount: "₹4.2L", tag: "Corporate", tagHue: "blue" },
  ] },
  { id: "visit", label: "Site visit", hue: "cyan", items: [
    { id: "3", title: "Reddy Reception", when: "Tomorrow, 4 PM", pax: 300, amount: "₹9.8L", tag: "Grand Hall", tagHue: "violet" },
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
        <h1 className="text-2xl font-semibold">Projects — design foundation</h1>
        <p className="text-sm text-muted-foreground">Phase 0 tokens &amp; primitives + the composed Workflow stepper and Readiness checklist.</p>
      </header>

      <Section title="Workspace kit (ClickUp-style) — module header · view tabs · board">
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
          <PageHeader
            title="Bookings"
            description="Every event across the pipeline, at a glance."
            eyebrow="Sales & CRM"
            icon={CalendarCheck}
            accent="blue"
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
                <p className="text-[13px] font-semibold leading-snug">{c.title}</p>
                <p className="text-[11.5px] text-muted-foreground">{c.when} · {c.pax} pax</p>
                <div className="flex items-center justify-between gap-2">
                  {c.tag ? <StatusPill label={c.tag} hue={c.tagHue} size="xs" /> : <span />}
                  <span className="text-[12px] font-bold tabular-nums">{c.amount}</span>
                </div>
              </div>
            )}
          />
        </div>
      </Section>

      <Section title="Colorful KPI tiles (StatTile) — gamified progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Revenue (MTD)" value="₹18.4L" accent="emerald" icon={<IndianRupee className="size-4" />} delta={12} deltaLabel="%" />
          <StatTile label="Bookings" value="34" accent="blue" icon={<CalendarCheck className="size-4" />} sub="6 this week" />
          <StatTile label="Goal progress" value="72%" accent="violet" icon={<Target className="size-4" />} pct={72} />
          <StatTile label="Day streak" value="9" accent="amber" icon={<Flame className="size-4" />} sub="Keep it going!" />
          <StatTile label="Team Velos" value="1,240" accent="pink" icon={<Trophy className="size-4" />} pct={88} />
          <StatTile label="New leads" value="21" accent="cyan" icon={<Users className="size-4" />} delta={-3} />
          <StatTile label="On-time %" value="94%" accent="teal" icon={<Target className="size-4" />} pct={94} />
          <StatTile label="At risk" value="2" accent="rose" icon={<Flame className="size-4" />} sub="Needs attention" />
        </div>
      </Section>

      <Section title="Module accent palette">
        <div className="flex flex-wrap gap-2">
          {[
            ["Sales & CRM", "bg-blue-500"], ["Delivery & Ops", "bg-amber-500"], ["People", "bg-violet-500"],
            ["Catalog & Finance", "bg-emerald-500"], ["Marketing", "bg-pink-500"], ["Workspace", "bg-cyan-500"],
          ].map(([label, dot]) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-card">
              <span className={`size-2 rounded-full ${dot}`} /> {label}
            </span>
          ))}
        </div>
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

      <Section title="StatusPill · phase hues">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="Handoff Received" hue="slate" size="sm" />
          <StatusPill label="CapEx & Timeline" hue="violet" size="sm" />
          <StatusPill label="Execution / Fit-out" hue="amber" size="sm" />
          <StatusPill label="Handover & Launch" hue="teal" size="sm" />
          <StatusPill label="Live / Handed Over" hue="emerald" size="sm" />
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
              badge={it.id === "1" ? <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-600"><ShieldAlert className="size-3" /> critical</span> : undefined}
            />
          ))}
        </CategorySection>
      </Section>

      <Section title="EmptyState">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border"><EmptyState tone="success" icon={<Check className="size-5" />} title="Nothing pending" description="Every standard has been signed off." /></div>
          <div className="rounded-xl border"><EmptyState icon={<Inbox className="size-5" />} title="No items match this filter" /></div>
        </div>
      </Section>
    </div>
  );
}
