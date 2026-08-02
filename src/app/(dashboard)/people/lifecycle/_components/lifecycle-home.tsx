"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Loader2, PlaneTakeoff, PlaneLanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { startOnboarding, startOffboarding } from "@/actions/hr-journey.actions";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

interface EmpLite { id: string; firstName: string; lastName: string; empCode: string }
interface Journey {
  id: string; status: string; targetDate: string | null; total: number; done: number; pct: number;
  employee: { id: string; firstName: string; lastName: string; empCode: string; photoUrl: string | null; legalEntity: { shortCode: string | null; name: string } | null };
}

export function LifecycleHome({
  joining, exits, employees,
}: {
  joining: Journey[]; exits: Journey[]; employees: EmpLite[];
}) {
  return (
    <Tabs defaultValue="joining">
      <TabsList className={TAB_LIST_SCROLL}>
        <TabsTrigger value="joining" className="gap-1.5"><PlaneLanding className="size-3.5" /> Joining ({joining.filter((j) => j.status === "IN_PROGRESS").length})</TabsTrigger>
        <TabsTrigger value="exits" className="gap-1.5"><PlaneTakeoff className="size-3.5" /> Exits ({exits.filter((j) => j.status === "IN_PROGRESS").length})</TabsTrigger>
      </TabsList>

      <TabsContent value="joining" className="space-y-3">
        <div className="flex justify-end"><StartOnboardingDialog employees={employees} /></div>
        <JourneyList journeys={joining} emptyText="No onboarding in progress. Start one when a new hire is confirmed." />
      </TabsContent>

      <TabsContent value="exits" className="space-y-3">
        <div className="flex justify-end"><StartOffboardingDialog employees={employees} /></div>
        <JourneyList journeys={exits} emptyText="No one is on notice — that’s a good thing." />
      </TabsContent>
    </Tabs>
  );
}

function JourneyList({ journeys, emptyText }: { journeys: Journey[]; emptyText: string }) {
  if (journeys.length === 0) {
    return <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="space-y-2.5">
      {journeys.map((j) => {
        const name = `${j.employee.firstName} ${j.employee.lastName}`;
        const initials = `${j.employee.firstName[0] ?? ""}${j.employee.lastName[0] ?? ""}`.toUpperCase();
        return (
          <Link key={j.id} href={`/people/lifecycle/${j.id}`}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-sm">
            <Avatar size="sm">
              <AvatarImage src={j.employee.photoUrl || undefined} alt={name} />
              <AvatarFallback className="bg-primary/10 text-meta font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{name}</span>
                <span className="text-detail text-muted-foreground">{j.employee.empCode}</span>
                {j.employee.legalEntity && <span className="text-meta text-muted-foreground">· {j.employee.legalEntity.shortCode || j.employee.legalEntity.name}</span>}
              </div>
              <div className="text-detail text-muted-foreground">
                {j.targetDate ? formatDate(j.targetDate) : "—"} · {j.done}/{j.total} tasks
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden w-28 sm:block">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${j.pct}%` }} />
                </div>
              </div>
              <span className="w-9 text-right text-detail font-medium tabular-nums">{j.pct}%</span>
              {j.status === "COMPLETED"
                ? <StatusPill label="Done" hue="emerald" size="xs" />
                : <StatusPill label="In progress" hue="amber" size="xs" />}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StartOnboardingDialog({ employees }: { employees: EmpLite[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [joiningDate, setJoiningDate] = React.useState("");

  async function go() {
    setError(null);
    if (!employeeId) { setError("Pick an employee."); return; }
    setSaving(true);
    const res = await startOnboarding(employeeId, joiningDate || undefined);
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.push(`/people/lifecycle/${res.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-1.5"><UserPlus className="size-4" /> Start onboarding</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start onboarding</DialogTitle>
          <DialogDescription>Creates a Day-1 checklist and moves the employee to Onboarding.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-detail">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.empCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-detail">Joining date</Label>
            <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={go} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />} Start</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartOffboardingDialog({ employees }: { employees: EmpLite[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [lastDay, setLastDay] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function go() {
    setError(null);
    if (!employeeId) { setError("Pick an employee."); return; }
    if (!lastDay) { setError("Set the last working day."); return; }
    setSaving(true);
    const res = await startOffboarding(employeeId, lastDay, reason || undefined);
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.push(`/people/lifecycle/${res.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-1.5"><UserMinus className="size-4" /> Initiate exit</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Initiate exit</DialogTitle>
          <DialogDescription>Creates a clearance checklist. Access is revoked when the journey is completed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-detail">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.empCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-detail">Last working day</Label>
            <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-detail">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Resignation, end of contract…" /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={go} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />} Initiate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
