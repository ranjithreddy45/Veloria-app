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
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
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

export default function StyleGuidePage() {
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
