"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusPill } from "@/components/shared/status-pill";
import {
  upsertDepartment, deleteDepartment,
  upsertDesignation, deleteDesignation,
  upsertLegalEntity, deleteLegalEntity,
  upsertBusinessVertical, deleteBusinessVertical,
} from "@/actions/hr-config.actions";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

// Mirror of OrgConfigListItem from hr-config.actions.
export interface OrgItem {
  id: string;
  name: string;
  isActive: boolean;
  order?: number;
  shortCode?: string | null;
  isIncorporated?: boolean;
  employeeCount: number;
}

export interface OrgConfigData {
  departments: OrgItem[];
  designations: OrgItem[];
  legalEntities: OrgItem[];
  businessVerticals: OrgItem[];
}

type Kind = "department" | "designation" | "legalEntity" | "businessVertical";
type Result = { success: true; data: { id: string } } | { success: false; error: string };

const KINDS: { key: Kind; tab: string; singular: string; empty: string; hasEntityFields?: boolean }[] = [
  { key: "department", tab: "Departments", singular: "department", empty: "No departments yet." },
  { key: "designation", tab: "Designations", singular: "designation", empty: "No designations yet." },
  { key: "legalEntity", tab: "Legal entities", singular: "legal entity", empty: "No legal entities yet.", hasEntityFields: true },
  { key: "businessVertical", tab: "Business verticals", singular: "business vertical", empty: "No business verticals yet." },
];

async function saveItem(kind: Kind, input: OrgItem & { name: string }): Promise<Result> {
  switch (kind) {
    case "department":
      return upsertDepartment({ id: input.id || undefined, name: input.name, isActive: input.isActive });
    case "designation":
      return upsertDesignation({ id: input.id || undefined, name: input.name, isActive: input.isActive });
    case "legalEntity":
      return upsertLegalEntity({
        id: input.id || undefined, name: input.name, isActive: input.isActive,
        shortCode: input.shortCode ?? null, isIncorporated: input.isIncorporated ?? true,
      });
    case "businessVertical":
      return upsertBusinessVertical({ id: input.id || undefined, name: input.name, isActive: input.isActive });
  }
}

async function removeItem(kind: Kind, id: string): Promise<Result> {
  switch (kind) {
    case "department": return deleteDepartment(id);
    case "designation": return deleteDesignation(id);
    case "legalEntity": return deleteLegalEntity(id);
    case "businessVertical": return deleteBusinessVertical(id);
  }
}

export function OrgConfigAdmin({ data }: { data: OrgConfigData }) {
  const lists: Record<Kind, OrgItem[]> = {
    department: data.departments,
    designation: data.designations,
    legalEntity: data.legalEntities,
    businessVertical: data.businessVerticals,
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
          <Building2 className="size-4.5" />
        </div>
        <div>
          <h3 className="text-copy font-semibold">Organisation</h3>
          <p className="text-detail text-muted-foreground">
            Departments, designations, legal entities and business verticals used across every employee profile.
          </p>
        </div>
      </div>

      <Tabs defaultValue="department">
        <TabsList className={`${TAB_LIST_SCROLL} mb-3`}>
          {KINDS.map((k) => (
            <TabsTrigger key={k.key} value={k.key}>{k.tab}</TabsTrigger>
          ))}
        </TabsList>
        {KINDS.map((k) => (
          <TabsContent key={k.key} value={k.key}>
            <ListSection meta={k} items={lists[k.key]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ListSection({
  meta, items,
}: {
  meta: (typeof KINDS)[number];
  items: OrgItem[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <ItemDialog kind={meta.key} singular={meta.singular} hasEntityFields={meta.hasEntityFields} />
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {meta.empty}
        </div>
      ) : (
        <div className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{it.name}</span>
                  {it.shortCode && <StatusPill label={it.shortCode} hue="slate" size="xs" />}
                  {meta.key === "legalEntity" && it.isIncorporated === false && (
                    <StatusPill label="Unincorporated" hue="amber" size="xs" />
                  )}
                  {!it.isActive && <StatusPill label="Inactive" hue="slate" size="xs" />}
                </div>
                <span className="inline-flex items-center gap-1 text-detail text-muted-foreground">
                  <Users className="size-3" />
                  {it.employeeCount} {it.employeeCount === 1 ? "employee" : "employees"}
                </span>
              </div>
              <ItemDialog kind={meta.key} singular={meta.singular} hasEntityFields={meta.hasEntityFields} existing={it} />
              <DeleteButton kind={meta.key} id={it.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteButton({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={!!error} onOpenChange={(o) => !o && setError(null)}>
      <Button
        variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await removeItem(kind, id);
          setBusy(false);
          if (!res.success) { setError(res.error); return; }
          router.refresh();
        }}
        title="Delete"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Can&apos;t delete</DialogTitle></DialogHeader>
        <p className="py-2 text-sm text-muted-foreground">{error}</p>
        <DialogFooter>
          <Button onClick={() => setError(null)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  kind, singular, hasEntityFields, existing,
}: {
  kind: Kind;
  singular: string;
  hasEntityFields?: boolean;
  existing?: OrgItem;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(existing?.name ?? "");
  const [shortCode, setShortCode] = React.useState(existing?.shortCode ?? "");
  const [isIncorporated, setIsIncorporated] = React.useState(existing?.isIncorporated ?? true);
  const [isActive, setIsActive] = React.useState(existing?.isActive ?? true);

  function reset() {
    setName(existing?.name ?? "");
    setShortCode(existing?.shortCode ?? "");
    setIsIncorporated(existing?.isIncorporated ?? true);
    setIsActive(existing?.isActive ?? true);
    setError(null);
  }

  async function save() {
    setError(null);
    setSaving(true);
    const res = await saveItem(kind, {
      id: existing?.id ?? "",
      name,
      isActive,
      shortCode: hasEntityFields ? (shortCode || null) : undefined,
      isIncorporated: hasEntityFields ? isIncorporated : undefined,
      employeeCount: 0,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    if (!existing) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add {singular}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${singular}` : `New ${singular}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${singular}`} autoFocus />
          </div>
          {hasEntityFields && (
            <>
              <div className="space-y-1.5">
                <Label className="text-detail">Short code (optional)</Label>
                <Input value={shortCode ?? ""} onChange={(e) => setShortCode(e.target.value)} placeholder="e.g. NV" />
              </div>
              <label className="flex items-center justify-between gap-2 text-body">
                <span>Incorporated entity</span>
                <Switch checked={isIncorporated} onCheckedChange={setIsIncorporated} />
              </label>
            </>
          )}
          <label className="flex items-center justify-between gap-2 text-body">
            <span>Active</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
