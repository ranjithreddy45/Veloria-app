"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { VENDOR_CATEGORIES } from "@/lib/constants";
import {
  listVendorCategoryDefs,
  createVendorCategory,
  updateVendorCategory,
  type VendorCategoryDefRow,
} from "@/actions/vendor-category.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CategoryAdminDialogProps {
  trigger: React.ReactNode;
}

export function CategoryAdminDialog({ trigger }: CategoryAdminDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [defs, setDefs] = React.useState<VendorCategoryDefRow[]>([]);
  const [newLabel, setNewLabel] = React.useState("");
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = React.useCallback(() => {
    setLoading(true);
    listVendorCategoryDefs()
      .then((res) => {
        if (res.success) setDefs(res.data);
        else toast.error(res.error);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      setNewLabel("");
      setCreateErr(null);
      load();
    }
  };

  const handleCreate = () => {
    if (!newLabel.trim()) {
      setCreateErr("Enter a category name");
      return;
    }
    setCreateErr(null);
    startTransition(async () => {
      const res = await createVendorCategory({ label: newLabel.trim() });
      if (res.success) {
        toast.success("Category added");
        setNewLabel("");
        load();
        router.refresh();
      } else {
        setCreateErr(res.fields?.key ?? res.fields?.label ?? res.error);
      }
    });
  };

  const toggleActive = (def: VendorCategoryDefRow, isActive: boolean) => {
    startTransition(async () => {
      const res = await updateVendorCategory(def.id, { isActive });
      if (res.success) {
        setDefs((prev) =>
          prev.map((d) => (d.id === def.id ? { ...d, isActive } : d))
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const saveLabel = (def: VendorCategoryDefRow, label: string) => {
    if (label.trim() === def.label || !label.trim()) return;
    startTransition(async () => {
      const res = await updateVendorCategory(def.id, { label: label.trim() });
      if (res.success) {
        setDefs((prev) =>
          prev.map((d) => (d.id === def.id ? { ...d, label: label.trim() } : d))
        );
        toast.success("Category updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lede font-semibold">Vendor categories</DialogTitle>
          <DialogDescription className="text-body">
            Add or manage the categories vendors and packages can use.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* Add new */}
          <div className="space-y-1.5">
            <Label htmlFor="new-cat" className="text-body font-medium">
              Add a category
            </Label>
            <div className="flex gap-2">
              <Input
                id="new-cat"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  setCreateErr(null);
                }}
                placeholder="e.g. Flower Wall"
                className="h-9 flex-1 text-body"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 text-body"
                onClick={handleCreate}
                disabled={pending || !newLabel.trim()}
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>
            {createErr && <p className="text-detail text-destructive">{createErr}</p>}
          </div>

          <Separator />

          {/* Seed (built-in) categories — read-only reference */}
          <div className="space-y-2">
            <p className="text-detail font-medium uppercase tracking-wide text-muted-foreground">
              Built-in
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VENDOR_CATEGORIES.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-detail text-muted-foreground"
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Custom categories */}
          <div className="space-y-2">
            <p className="text-detail font-medium uppercase tracking-wide text-muted-foreground">
              Custom
            </p>
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-body text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </div>
            ) : defs.length === 0 ? (
              <p className="py-2 text-body text-muted-foreground/70">
                No custom categories yet.
              </p>
            ) : (
              <div className="space-y-2">
                {defs.map((def) => (
                  <div
                    key={def.id}
                    className="flex items-center gap-2 rounded-lg border border-border/70 p-2"
                  >
                    <Input
                      defaultValue={def.label}
                      onBlur={(e) => saveLabel(def, e.target.value)}
                      className="h-8 flex-1 text-body"
                    />
                    <span className="shrink-0 font-mono text-meta text-muted-foreground">
                      {def.key}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Switch
                        checked={def.isActive}
                        onCheckedChange={(v) => toggleActive(def, v)}
                        disabled={pending}
                      />
                      <span className="text-meta text-muted-foreground">
                        {def.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
