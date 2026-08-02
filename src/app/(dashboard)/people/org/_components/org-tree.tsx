"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronDown, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE } from "@/lib/hr/constants";
import type { OrgNode } from "@/actions/hr-employee.actions";
import type { EmployeeStatus } from "@prisma/client";

type Lookup = { id: string; name: string; shortCode?: string | null };
const ALL = "__all__";

interface TreeNode extends OrgNode { children: TreeNode[] }

function buildForest(nodes: OrgNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  nodes.forEach((n) => byId.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.managerId ? byId.get(node.managerId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node); // top of chain, or manager filtered out of this view
  });
  return roots;
}

export function OrgTree({
  nodes, entities, verticals,
}: {
  nodes: OrgNode[]; entities: Lookup[]; verticals: Lookup[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const forest = React.useMemo(() => buildForest(nodes), [nodes]);

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    if (value && value !== ALL) sp.set(key, value);
    else sp.delete(key);
    router.replace(`/people/org?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Picker label="Entity" value={params.get("entity") ?? ALL} onChange={(v) => setParam("entity", v)}
          options={entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))} />
        <Picker label="Vertical" value={params.get("vertical") ?? ALL} onChange={(v) => setParam("vertical", v)}
          options={verticals.map((v) => ({ value: v.id, label: v.name }))} />
        <span className="ml-auto text-detail text-muted-foreground">{nodes.length} people</span>
      </div>

      {forest.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No employees in this view.
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-2 sm:p-4">
          {forest.map((root) => <Node key={root.id} node={root} depth={0} />)}
        </div>
      )}
    </div>
  );
}

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const initials = node.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
        style={{ paddingLeft: depth * 22 + 8 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted ${hasChildren ? "" : "invisible"}`}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Avatar size="sm">
          <AvatarImage src={node.photoUrl || undefined} alt={node.name} />
          <AvatarFallback className="bg-primary/10 text-meta font-semibold text-primary">{initials || "?"}</AvatarFallback>
        </Avatar>
        <Link href={`/people/${node.id}`} className="min-w-0 flex-1">
          <span className="truncate text-body font-medium hover:underline">{node.name}</span>
          <span className="ml-2 text-detail text-muted-foreground">
            {node.designation || node.department || node.empCode}
            {node.entityShort ? ` · ${node.entityShort}` : ""}
          </span>
        </Link>
        {hasChildren && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-meta text-muted-foreground">
            <Users className="size-3" />{node.children.length}
          </span>
        )}
        <StatusPill label={EMPLOYEE_STATUS_LABELS[node.status as EmployeeStatus]} hue={EMPLOYEE_STATUS_HUE[node.status as EmployeeStatus]} size="xs" />
      </div>
      {open && hasChildren && (
        <div className="border-l border-dashed border-border" style={{ marginLeft: depth * 22 + 18 }}>
          {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function Picker({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[8.5rem]"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
