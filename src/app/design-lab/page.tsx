"use client";

// ============================================================
// /design-lab — internal Apple-UI reference harness (noindex, public route,
// no data). Renders the REAL primitives so the design system can be polished
// and screenshotted against the Apple reference. Not linked from the app.
// ============================================================

import * as React from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { LeadStatusPill } from "@/components/shared/status-pill";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { PlusIcon, TrendingUpIcon, IndianRupeeIcon, UsersIcon, CalendarCheckIcon } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-detail font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h3>
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">{children}</div>
    </section>
  );
}

function Lab() {
  const [seg, setSeg] = React.useState("month");
  return (
    <div className="mx-auto max-w-5xl space-y-9 p-8">
      <header className="space-y-1">
        <div className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">Design system</div>
        <h1 className="text-h1">Veloria UI — Apple</h1>
        <p className="text-copy text-muted-foreground">Real primitives, tuned to the reference. San Francisco, system materials, restrained emerald.</p>
      </header>

      {/* KPI tiles */}
      <Section title="Stat tiles">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Pipeline value" value="₹42.8L" accent="emerald" icon={<IndianRupeeIcon />} delta={18} deltaLabel="vs last month" />
          <StatTile label="New enquiries" value="34" accent="blue" icon={<UsersIcon />} delta={9} deltaLabel="this month" />
          <StatTile label="Conversion" value="31%" accent="amber" icon={<TrendingUpIcon />} delta={-2} deltaLabel="enquiry → booking" />
          <StatTile label="Bookings" value="11" accent="teal" icon={<CalendarCheckIcon />} delta={3} deltaLabel="₹68.2L" />
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button><PlusIcon /> New enquiry</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add"><PlusIcon /></Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      {/* Form controls */}
      <Section title="Form controls">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client name</Label>
            <Input placeholder="e.g. Ananya Rao" />
          </div>
          <div className="space-y-1.5">
            <Label>Occasion</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select occasion" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="reception">Reception</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea placeholder="Anything the team should know…" rows={3} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-body"><Checkbox defaultChecked /> Send WhatsApp</label>
            <label className="flex items-center gap-2 text-body"><Switch defaultChecked /> VIP</label>
          </div>
        </div>
      </Section>

      {/* Segmented + tabs */}
      <Section title="Segmented control & tabs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="inline-flex rounded-[10px] bg-muted p-0.5">
            {["week", "month", "quarter"].map((k) => (
              <button
                key={k}
                onClick={() => setSeg(k)}
                className={
                  "rounded-lg px-3.5 py-1.5 text-detail font-medium capitalize transition-colors " +
                  (seg === k ? "bg-card text-foreground shadow-[0_0.5px_2px_oklch(0_0_0/0.14)]" : "text-muted-foreground")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="new">New</TabsTrigger>
              <TabsTrigger value="won">Won</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-4 text-body text-muted-foreground">All leads across the pipeline.</TabsContent>
            <TabsContent value="new" className="pt-4 text-body text-muted-foreground">Fresh enquiries awaiting first contact.</TabsContent>
            <TabsContent value="won" className="pt-4 text-body text-muted-foreground">Confirmed bookings.</TabsContent>
          </Tabs>
        </div>
      </Section>

      {/* Status pills */}
      <Section title="Status">
        <div className="flex flex-wrap items-center gap-2">
          {["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "WON", "LOST", "NOT_CONNECTED"].map((s) => (
            <LeadStatusPill key={s} status={s} />
          ))}
        </div>
      </Section>

      {/* Table */}
      <Section title="Leads table">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Est. value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { n: "Ananya Rao", e: "Wedding · 600 pax", v: "₹8.4L", s: "WON" },
                { n: "Karthik Menon", e: "Reception · 350 pax", v: "₹5.1L", s: "NEGOTIATION" },
                { n: "Sneha Desai", e: "Engagement · 220 pax", v: "₹3.6L", s: "QUALIFIED" },
                { n: "Rohit Varma", e: "Corporate · 500 pax", v: "₹6.9L", s: "NEW" },
              ].map((r) => (
                <TableRow key={r.n}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <DotAvatar seed={r.n} name={r.n} />
                      <span className="font-medium">{r.n}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.e}</TableCell>
                  <TableCell className="text-right font-semibold numeric">{r.v}</TableCell>
                  <TableCell><LeadStatusPill status={r.s} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  );
}

export default function DesignLabPage() {
  // Internal design harness only — never exposed on the production site.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen bg-background">
      <Lab />
      {/* Dark preview, inline, so both themes are visible in one shot */}
      <div className="dark bg-background border-t border-border">
        <Lab />
      </div>
    </div>
  );
}
