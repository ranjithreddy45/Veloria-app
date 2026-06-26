"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  UtensilsCrossedIcon,
  ShoppingCartIcon,
  TruckIcon,
  FileTextIcon,
} from "lucide-react";

import { updateSOPTemplateSeeds } from "@/actions/sop-template.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ============================================================
// Local form types — these mirror the JSON shapes consumed by
// src/lib/ops/provision.ts. Numbers are kept as strings in the form and parsed
// on save (empty string → field omitted).
// ============================================================

interface KitchenRow {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  estUnitCost: string;
}

interface ProcurementItemRow {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

interface ProcurementRow {
  title: string;
  department: string;
  neededByOffsetDays: string;
  items: ProcurementItemRow[];
}

interface DispatchItemRow {
  name: string;
  quantity: string;
  returnable: boolean;
}

interface DispatchRow {
  fromLocation: string;
  toLocation: string;
  items: DispatchItemRow[];
}

interface BeoForm {
  menuNotes: string;
  floorPlanNotes: string;
  avNotes: string;
  decorNotes: string;
  staffingNotes: string;
  specialInstructions: string;
}

export interface SeedBuilderProps {
  templateId: string;
  // Raw JSON read straight from the template row (already serialized).
  initialKitchenSeed: unknown;
  initialProcurementSeed: unknown;
  initialDispatchSeed: unknown;
  initialBeoDefaults: unknown;
}

// ============================================================
// Hydration helpers — turn stored JSON into form rows.
// ============================================================

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function numStr(v: unknown): string {
  return v === null || v === undefined || v === "" ? "" : String(v);
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function hydrateKitchen(v: unknown): KitchenRow[] {
  return asArray(v).map((r) => ({
    name: str(r.name),
    category: str(r.category),
    quantity: numStr(r.quantity),
    unit: str(r.unit),
    estUnitCost: numStr(r.estUnitCost),
  }));
}

function hydrateProcurement(v: unknown): ProcurementRow[] {
  return asArray(v).map((r) => ({
    title: str(r.title),
    department: str(r.department),
    neededByOffsetDays: numStr(r.neededByOffsetDays),
    items: asArray(r.items).map((it) => ({
      name: str(it.name),
      quantity: numStr(it.quantity),
      unit: str(it.unit),
      unitPrice: numStr(it.unitPrice),
    })),
  }));
}

function hydrateDispatch(v: unknown): DispatchRow[] {
  return asArray(v).map((r) => ({
    fromLocation: str(r.fromLocation),
    toLocation: str(r.toLocation),
    items: asArray(r.items).map((it) => ({
      name: str(it.name),
      quantity: numStr(it.quantity),
      returnable: !!it.returnable,
    })),
  }));
}

function hydrateBeo(v: unknown): BeoForm {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    menuNotes: str(o.menuNotes),
    floorPlanNotes: str(o.floorPlanNotes),
    avNotes: str(o.avNotes),
    decorNotes: str(o.decorNotes),
    staffingNotes: str(o.staffingNotes),
    specialInstructions: str(o.specialInstructions),
  };
}

// ============================================================
// Serialize helpers — turn form rows into the exact provision.ts JSON shapes.
// Empty optional fields are omitted; numbers are parsed.
// ============================================================

function optNum(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function optInt(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function optStr(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

function serializeKitchen(rows: KitchenRow[]) {
  return rows
    .filter((r) => r.name.trim() !== "")
    .map((r) => ({
      name: r.name.trim(),
      category: optStr(r.category),
      quantity: optNum(r.quantity),
      unit: optStr(r.unit),
      estUnitCost: optNum(r.estUnitCost),
    }));
}

function serializeProcurement(rows: ProcurementRow[]) {
  return rows
    .filter((r) => r.title.trim() !== "")
    .map((r) => ({
      title: r.title.trim(),
      department: optStr(r.department),
      neededByOffsetDays: optInt(r.neededByOffsetDays),
      items: r.items
        .filter((it) => it.name.trim() !== "")
        .map((it) => ({
          name: it.name.trim(),
          quantity: optNum(it.quantity),
          unit: optStr(it.unit),
          unitPrice: optNum(it.unitPrice),
        })),
    }));
}

function serializeDispatch(rows: DispatchRow[]) {
  return rows
    .filter(
      (r) =>
        r.fromLocation.trim() !== "" ||
        r.toLocation.trim() !== "" ||
        r.items.some((it) => it.name.trim() !== "")
    )
    .map((r) => ({
      fromLocation: optStr(r.fromLocation),
      toLocation: optStr(r.toLocation),
      items: r.items
        .filter((it) => it.name.trim() !== "")
        .map((it) => ({
          name: it.name.trim(),
          quantity: optNum(it.quantity),
          returnable: it.returnable,
        })),
    }));
}

function serializeBeo(b: BeoForm) {
  const out: Record<string, string> = {};
  (Object.keys(b) as (keyof BeoForm)[]).forEach((k) => {
    const v = b[k].trim();
    if (v !== "") out[k] = v;
  });
  return out;
}

// ============================================================
// Component
// ============================================================

export function SeedBuilder({
  templateId,
  initialKitchenSeed,
  initialProcurementSeed,
  initialDispatchSeed,
  initialBeoDefaults,
}: SeedBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [kitchen, setKitchen] = React.useState<KitchenRow[]>(() =>
    hydrateKitchen(initialKitchenSeed)
  );
  const [procurement, setProcurement] = React.useState<ProcurementRow[]>(() =>
    hydrateProcurement(initialProcurementSeed)
  );
  const [dispatch, setDispatch] = React.useState<DispatchRow[]>(() =>
    hydrateDispatch(initialDispatchSeed)
  );
  const [beo, setBeo] = React.useState<BeoForm>(() =>
    hydrateBeo(initialBeoDefaults)
  );

  function handleSave() {
    startTransition(async () => {
      const result = await updateSOPTemplateSeeds(templateId, {
        kitchenSeed: serializeKitchen(kitchen),
        procurementSeed: serializeProcurement(procurement),
        dispatchSeed: serializeDispatch(dispatch),
        beoDefaults: serializeBeo(beo),
      });
      if (result.success) {
        toast.success("Provisioning seeds saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to save provisioning seeds");
      }
    });
  }

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Provisioning seeds</CardTitle>
            <CardDescription>
              When a booking using this template is confirmed, these seeds stand
              up each team&apos;s workspace automatically — a kitchen plan,
              purchase requisitions, dispatch orders and the BEO notes.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Save Seeds
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="kitchen" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="kitchen">
              <UtensilsCrossedIcon className="mr-1.5 size-3.5" />
              Kitchen
            </TabsTrigger>
            <TabsTrigger value="procurement">
              <ShoppingCartIcon className="mr-1.5 size-3.5" />
              Procurement
            </TabsTrigger>
            <TabsTrigger value="dispatch">
              <TruckIcon className="mr-1.5 size-3.5" />
              Dispatch
            </TabsTrigger>
            <TabsTrigger value="beo">
              <FileTextIcon className="mr-1.5 size-3.5" />
              BEO Notes
            </TabsTrigger>
          </TabsList>

          {/* Kitchen ----------------------------------------------------- */}
          <TabsContent value="kitchen" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Each row becomes a line on the kitchen plan created at confirm.
            </p>
            <div className="space-y-2">
              {kitchen.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 p-3 sm:grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1fr_auto]"
                >
                  <Input
                    placeholder="Item name *"
                    value={row.name}
                    onChange={(e) =>
                      setKitchen((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, name: e.target.value } : r
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Category"
                    value={row.category}
                    onChange={(e) =>
                      setKitchen((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, category: e.target.value } : r
                        )
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) =>
                      setKitchen((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, quantity: e.target.value } : r
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Unit"
                    value={row.unit}
                    onChange={(e) =>
                      setKitchen((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, unit: e.target.value } : r
                        )
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit cost"
                    value={row.estUnitCost}
                    onChange={(e) =>
                      setKitchen((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, estUnitCost: e.target.value } : r
                        )
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      setKitchen((p) => p.filter((_, j) => j !== i))
                    }
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setKitchen((p) => [
                  ...p,
                  {
                    name: "",
                    category: "",
                    quantity: "",
                    unit: "",
                    estUnitCost: "",
                  },
                ])
              }
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Item
            </Button>
          </TabsContent>

          {/* Procurement ------------------------------------------------- */}
          <TabsContent value="procurement" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Each block becomes one purchase requisition. &ldquo;Needed
              before&rdquo; is the number of days before the event date the
              requisition is due.
            </p>
            <div className="space-y-3">
              {procurement.map((req, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.2fr_1fr_auto]">
                    <Input
                      placeholder="Requisition title *"
                      value={req.title}
                      onChange={(e) =>
                        setProcurement((p) =>
                          p.map((r, j) =>
                            j === i ? { ...r, title: e.target.value } : r
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="Department"
                      value={req.department}
                      onChange={(e) =>
                        setProcurement((p) =>
                          p.map((r, j) =>
                            j === i ? { ...r, department: e.target.value } : r
                          )
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Days before"
                      value={req.neededByOffsetDays}
                      onChange={(e) =>
                        setProcurement((p) =>
                          p.map((r, j) =>
                            j === i
                              ? { ...r, neededByOffsetDays: e.target.value }
                              : r
                          )
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setProcurement((p) => p.filter((_, j) => j !== i))
                      }
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-3 border-l-2 border-zinc-200/70 dark:border-zinc-700/70">
                    <Label className="text-xs text-muted-foreground">
                      Line items
                    </Label>
                    {req.items.map((it, k) => (
                      <div
                        key={k}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_0.8fr_0.8fr_1fr_auto]"
                      >
                        <Input
                          placeholder="Item name *"
                          value={it.name}
                          onChange={(e) =>
                            setProcurement((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, name: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) =>
                            setProcurement((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, quantity: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Unit"
                          value={it.unit}
                          onChange={(e) =>
                            setProcurement((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, unit: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Unit price"
                          value={it.unitPrice}
                          onChange={(e) =>
                            setProcurement((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, unitPrice: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setProcurement((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.filter((_, m) => m !== k),
                                    }
                                  : r
                              )
                            )
                          }
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProcurement((p) =>
                          p.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  items: [
                                    ...r.items,
                                    {
                                      name: "",
                                      quantity: "",
                                      unit: "",
                                      unitPrice: "",
                                    },
                                  ],
                                }
                              : r
                          )
                        )
                      }
                    >
                      <PlusIcon className="mr-1.5 size-3.5" />
                      Add Line Item
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setProcurement((p) => [
                  ...p,
                  {
                    title: "",
                    department: "",
                    neededByOffsetDays: "",
                    items: [],
                  },
                ])
              }
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Requisition
            </Button>
          </TabsContent>

          {/* Dispatch ---------------------------------------------------- */}
          <TabsContent value="dispatch" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Each block becomes one dispatch order, scheduled for the event
              date.
            </p>
            <div className="space-y-3">
              {dispatch.map((d, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      placeholder="From location"
                      value={d.fromLocation}
                      onChange={(e) =>
                        setDispatch((p) =>
                          p.map((r, j) =>
                            j === i ? { ...r, fromLocation: e.target.value } : r
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="To location"
                      value={d.toLocation}
                      onChange={(e) =>
                        setDispatch((p) =>
                          p.map((r, j) =>
                            j === i ? { ...r, toLocation: e.target.value } : r
                          )
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setDispatch((p) => p.filter((_, j) => j !== i))
                      }
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-3 border-l-2 border-zinc-200/70 dark:border-zinc-700/70">
                    <Label className="text-xs text-muted-foreground">
                      Items
                    </Label>
                    {d.items.map((it, k) => (
                      <div
                        key={k}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_0.8fr_auto_auto] sm:items-center"
                      >
                        <Input
                          placeholder="Item name *"
                          value={it.name}
                          onChange={(e) =>
                            setDispatch((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, name: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) =>
                            setDispatch((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.map((x, m) =>
                                        m === k
                                          ? { ...x, quantity: e.target.value }
                                          : x
                                      ),
                                    }
                                  : r
                              )
                            )
                          }
                        />
                        <div className="flex items-center gap-2 px-1">
                          <Switch
                            checked={it.returnable}
                            onCheckedChange={(checked) =>
                              setDispatch((p) =>
                                p.map((r, j) =>
                                  j === i
                                    ? {
                                        ...r,
                                        items: r.items.map((x, m) =>
                                          m === k
                                            ? { ...x, returnable: checked }
                                            : x
                                        ),
                                      }
                                    : r
                                )
                              )
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            Returnable
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDispatch((p) =>
                              p.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      items: r.items.filter((_, m) => m !== k),
                                    }
                                  : r
                              )
                            )
                          }
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDispatch((p) =>
                          p.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  items: [
                                    ...r.items,
                                    {
                                      name: "",
                                      quantity: "",
                                      returnable: false,
                                    },
                                  ],
                                }
                              : r
                          )
                        )
                      }
                    >
                      <PlusIcon className="mr-1.5 size-3.5" />
                      Add Item
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDispatch((p) => [
                  ...p,
                  { fromLocation: "", toLocation: "", items: [] },
                ])
              }
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Dispatch Order
            </Button>
          </TabsContent>

          {/* BEO Notes --------------------------------------------------- */}
          <TabsContent value="beo" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              These notes prefill the BEO / function sheet created at confirm.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["menuNotes", "Menu notes"],
                  ["floorPlanNotes", "Floor plan notes"],
                  ["avNotes", "AV notes"],
                  ["decorNotes", "Decor notes"],
                  ["staffingNotes", "Staffing notes"],
                  ["specialInstructions", "Special instructions"],
                ] as [keyof BeoForm, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`beo-${key}`}>{label}</Label>
                  <Textarea
                    id={`beo-${key}`}
                    rows={3}
                    value={beo[key]}
                    onChange={(e) =>
                      setBeo((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
