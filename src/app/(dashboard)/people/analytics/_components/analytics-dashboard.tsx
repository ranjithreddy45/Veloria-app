"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Users, UserMinus, CalendarCheck, ClipboardCheck, UserPlus, UserCheck } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Pair = { name: string; value: number };
type GenderSlice = { name: string; value: number; pct: number };
interface Data {
  headcount: { total: number; active: number; onboarding: number; onLeave: number };
  attrition: { exits12m: number; ratePct: number };
  byEntity: Pair[]; byVertical: Pair[]; byDepartment: Pair[]; byType: Pair[];
  attendance: { presentPct: number | null };
  leave: { pending: number; byType: Pair[] };
  appraisal: { submitted: number; eligible: number; pct: number } | null;
  cycleName: string | null;
  genderSplit: GenderSlice[];
  tenure: { distribution: Pair[]; avgYears: number };
  ageProfile: Pair[];
  joinedThisMonth: number;
  confirmationPending: number;
  filterOptions: { entities: { id: string; name: string; shortCode: string | null }[]; verticals: { id: string; name: string }[] };
}

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const PIE_COLORS = ["#2D1B3D", "#C9A96E", "#6E5A86", "#A98F66", "#9B8AAC", "#D9C7A8", "#4A3A5E"];
const ALL = "__all__";

export function AnalyticsDashboard({ data }: { data: Data }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    if (value && value !== ALL) sp.set(key, value); else sp.delete(key);
    router.replace(`/people/analytics?${sp.toString()}`);
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Picker label="Entity" value={params.get("entity") ?? ALL} onChange={(v) => setParam("entity", v)}
          options={data.filterOptions.entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))} />
        <Picker label="Vertical" value={params.get("vertical") ?? ALL} onChange={(v) => setParam("vertical", v)}
          options={data.filterOptions.verticals.map((v) => ({ value: v.id, label: v.name }))} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Headcount" value={data.headcount.total} sub={`${data.headcount.active} active · ${data.headcount.onboarding} onboarding`} accent />
        <Kpi icon={<UserMinus className="size-4" />} label="Attrition (12 mo)" value={`${data.attrition.ratePct}%`} sub={`${data.attrition.exits12m} exits`} />
        <Kpi icon={<CalendarCheck className="size-4" />} label="Attendance (mo)" value={data.attendance.presentPct != null ? `${data.attendance.presentPct}%` : "—"} sub={`${data.leave.pending} leave pending`} />
        <Kpi icon={<ClipboardCheck className="size-4" />} label="Appraisals" value={data.appraisal ? `${data.appraisal.pct}%` : "—"} sub={data.cycleName ? `${data.cycleName} · ${data.appraisal?.submitted ?? 0}/${data.appraisal?.eligible ?? 0}` : "No active cycle"} />
        <Kpi icon={<UserPlus className="size-4" />} label="Joined (this month)" value={data.joinedThisMonth} sub="New joiners this period" />
        <Kpi icon={<UserCheck className="size-4" />} label="Confirmation Pending" value={data.confirmationPending} sub="Still on probation (onboarding)" />
        <Kpi icon={<CalendarCheck className="size-4" />} label="Avg tenure" value={`${data.tenure.avgYears.toFixed(1)} yr`} sub="Active employees" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Headcount by legal entity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byEntity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={PLUM} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By business vertical">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.byVertical} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>
                {data.byVertical.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Headcount by department">
          <ResponsiveContainer width="100%" height={Math.max(200, data.byDepartment.length * 28)}>
            <BarChart data={data.byDepartment} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={GOLD} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment type">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(e) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>
                {data.byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Demographics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Gender split">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.genderSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: { name: string; pct: number }) => `${e.name} ${e.pct}%`} labelLine={false} fontSize={11}>
                {data.genderSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number, _n, p: { payload?: GenderSlice }) => [`${v} (${p.payload?.pct ?? 0}%)`, "Employees"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Tenure distribution · avg ${data.tenure.avgYears.toFixed(1)} yr`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.tenure.distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Age profile">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.ageProfile} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={PLUM} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {data.leave.byType.length > 0 && (
        <ChartCard title="Leave taken this year (days, by type)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.leave.byType} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={PLUM} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        <span className="text-detail font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-meta text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-body font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[9rem]"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
