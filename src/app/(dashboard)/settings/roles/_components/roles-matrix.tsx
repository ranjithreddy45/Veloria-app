"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { setRolePermission } from "@/actions/rbac.actions";

const ROLE_LABEL: Record<string, string> = {
  SALES_EXEC: "Sales Exec",
  SALES_HEAD: "Sales Head",
  EVENT_COORDINATOR: "Event Coord.",
  FINANCE: "Finance",
  STAFF: "Staff",
  BD_EXECUTIVE: "BD Exec",
  BD_HEAD: "BD Head",
  OPERATIONS: "Operations",
  LEGAL: "Legal",
  PROJECTS_EXEC: "Projects Exec",
  PROJECTS_HEAD: "Projects Head",
};

function categoryOf(permission: string): string {
  return permission.split(":")[0];
}
function actionOf(permission: string): string {
  return permission.split(":").slice(1).join(":").replaceAll("-", " ");
}
function titleCase(s: string): string {
  return s.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RolesPermissionsMatrix({
  roles,
  permissions,
  effective,
}: {
  roles: string[];
  permissions: string[];
  effective: Record<string, string[]>;
}) {
  // Local optimistic state: role → Set of granted permissions.
  const [granted, setGranted] = React.useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of roles) m[r] = new Set(effective[r] ?? []);
    return m;
  });
  const [pending, setPending] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  // Group permissions by category.
  const groups = React.useMemo(() => {
    const map = new Map<string, string[]>();
    const term = query.trim().toLowerCase();
    for (const p of permissions) {
      if (term && !p.toLowerCase().includes(term)) continue;
      const cat = categoryOf(p);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions, query]);

  async function toggle(role: string, permission: string, next: boolean) {
    const key = `${role}:${permission}`;
    setPending(key);
    // Optimistic
    setGranted((prev) => {
      const copy = { ...prev, [role]: new Set(prev[role]) };
      if (next) copy[role].add(permission);
      else copy[role].delete(permission);
      return copy;
    });
    try {
      const res = await setRolePermission(role, permission, next);
      if (!res.success) {
        toast.error(res.error);
        // revert
        setGranted((prev) => {
          const copy = { ...prev, [role]: new Set(prev[role]) };
          if (next) copy[role].delete(permission);
          else copy[role].add(permission);
          return copy;
        });
      }
    } catch {
      toast.error("Couldn't update — please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search permissions…"
          className="h-9 pl-8"
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-detail">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left text-meta uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Permission</th>
                {roles.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-medium">{ROLE_LABEL[r] ?? r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([cat, perms]) => {
                const isCollapsed = collapsed.has(cat);
                return (
                  <React.Fragment key={cat}>
                    <tr className="border-b border-border bg-muted/40">
                      <td colSpan={roles.length + 1} className="px-2 py-1.5">
                        <button
                          className="flex items-center gap-1.5 font-semibold text-foreground"
                          onClick={() =>
                            setCollapsed((prev) => {
                              const c = new Set(prev);
                              if (c.has(cat)) c.delete(cat);
                              else c.add(cat);
                              return c;
                            })
                          }
                        >
                          {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          {titleCase(cat)}
                        </button>
                      </td>
                    </tr>
                    {!isCollapsed &&
                      perms.map((p) => (
                        <tr key={p} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5 text-foreground">{titleCase(actionOf(p))}</td>
                          {roles.map((r) => {
                            const on = granted[r]?.has(p) ?? false;
                            const key = `${r}:${p}`;
                            return (
                              <td key={r} className="px-2 py-1.5 text-center">
                                <Checkbox
                                  checked={on}
                                  disabled={pending === key}
                                  onCheckedChange={(v) => toggle(r, p, !!v)}
                                  aria-label={`${ROLE_LABEL[r] ?? r} — ${p}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
