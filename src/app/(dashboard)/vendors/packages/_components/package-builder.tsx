"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  PlusIcon,
  Trash2Icon,
  ImageIcon,
  StarIcon,
  XIcon,
  GripVerticalIcon,
  CheckIcon,
  AlertCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  VENDOR_PACKAGE_PRICE_UNITS,
  VENDOR_MAX_DISCOUNT_TYPES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  createPackage,
  updatePackage,
  addPackageImage,
  setPackageCover,
  deletePackageImage,
  reorderPackageImages,
} from "@/actions/vendor-catalog.actions";
import type { CategoryOption } from "@/app/(dashboard)/vendors/_components/vendor-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PackageCard } from "@/app/(dashboard)/vendors/_components/package-card";
import type { PackageCardData } from "@/app/(dashboard)/vendors/_components/vendor-module";

// ============================================================
// Local types
// ============================================================

type ItemType = "FIXED" | "SINGLE_CHOICE" | "MULTI_CHOICE";

interface LocalItem {
  _key: string;
  name: string;
  type: ItemType;
  options: string[];
  chooseCount: number;
  notes: string;
}

interface LocalSection {
  _key: string;
  title: string;
  items: LocalItem[];
}

interface Image {
  id: string;
  url: string;
  sortOrder: number;
}

interface FullPackage {
  id: string;
  name: string;
  vendorId: string;
  category: string;
  status: string;
  price: number;
  priceUnit: string;
  currency: string;
  description: string | null;
  vendorPrice: number | null;
  customerPrice: number | null;
  minPax: number | null;
  maxDiscountType: string | null;
  maxDiscountValue: number | null;
  coverImageId: string | null;
  vendor: { id: string; name: string; categories: string[] };
  sections: {
    id: string;
    title: string;
    sortOrder: number;
    items: {
      id: string;
      name: string;
      type: string;
      options: string[];
      chooseCount: number | null;
      sortOrder: number;
      notes: string | null;
    }[];
  }[];
  images: Image[];
}

interface PackageBuilderProps {
  vendors: { id: string; name: string; categories: string[] }[];
  categories: CategoryOption[];
  initial?: FullPackage;
  defaultVendorId?: string;
}

// ============================================================
// Helpers
// ============================================================

function genKey() {
  return Math.random().toString(36).slice(2);
}

function emptyItem(): LocalItem {
  return {
    _key: genKey(),
    name: "",
    type: "FIXED",
    options: [],
    chooseCount: 1,
    notes: "",
  };
}

function emptySection(): LocalSection {
  return { _key: genKey(), title: "", items: [emptyItem()] };
}

function toLocalSections(
  sections: FullPackage["sections"]
): LocalSection[] {
  return sections.map((s) => ({
    _key: genKey(),
    title: s.title,
    items: s.items.map((it) => ({
      _key: genKey(),
      name: it.name,
      type: it.type as ItemType,
      options: it.options ?? [],
      chooseCount: it.chooseCount ?? 1,
      notes: it.notes ?? "",
    })),
  }));
}

function buildPreview(
  vendorId: string,
  vendorName: string,
  category: string,
  status: string,
  name: string,
  price: number,
  priceUnit: string,
  description: string,
  coverUrl: string | null,
  sections: LocalSection[]
): PackageCardData {
  const itemCount = sections.reduce((a, s) => a + s.items.length, 0);
  return {
    id: "preview",
    name: name || "Untitled package",
    category,
    status,
    price,
    priceUnit,
    currency: "INR",
    description: description || null,
    vendor: { id: vendorId, name: vendorName || "Select a vendor" },
    coverUrl,
    sectionCount: sections.length,
    itemCount,
  };
}

// ============================================================
// ItemEditor sub-component
// ============================================================

interface ItemEditorProps {
  item: LocalItem;
  onChange: (updated: LocalItem) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  fieldErrors?: Record<string, string>;
}

function ItemEditor({
  item,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ItemEditorProps) {
  const update = (patch: Partial<LocalItem>) => onChange({ ...item, ...patch });

  const TYPE_LABELS: Record<ItemType, string> = {
    FIXED: "Fixed inclusion",
    SINGLE_CHOICE: "Pick one",
    MULTI_CHOICE: "Pick several",
  };

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
      {/* Name row */}
      <div className="flex items-center gap-2">
        <GripVerticalIcon className="size-4 text-muted-foreground/40 shrink-0" />
        <Input
          value={item.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Item name"
          className="h-8 flex-1 text-[13px]"
        />
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
            aria-label="Move item up"
          >
            <ChevronUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
            aria-label="Move item down"
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove item"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex flex-wrap gap-1">
        {(["FIXED", "SINGLE_CHOICE", "MULTI_CHOICE"] as ItemType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => update({ type: t })}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
              item.type === t
                ? "border-teal-500/35 bg-teal-500/12 text-teal-700 dark:text-teal-300"
                : "border-border bg-background text-muted-foreground hover:border-border/80"
            )}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Type-specific controls */}
      {item.type === "FIXED" && (
        <p className="text-[11px] text-muted-foreground italic">
          Always included — no options
        </p>
      )}

      {item.type !== "FIXED" && (
        <div className="space-y-2">
          {item.type === "MULTI_CHOICE" && (
            <div className="flex items-center gap-2">
              <Label className="text-[12px] text-muted-foreground whitespace-nowrap">
                Guest picks
              </Label>
              <Input
                type="number"
                min={1}
                value={item.chooseCount}
                onChange={(e) =>
                  update({ chooseCount: Math.max(1, Number(e.target.value) || 1) })
                }
                className="h-7 w-16 text-[12px] tabular-nums"
              />
              <span className="text-[12px] text-muted-foreground">option(s)</span>
            </div>
          )}

          {/* Options list */}
          <div className="space-y-1.5">
            {item.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-1.5">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...item.options];
                    opts[oi] = e.target.value;
                    update({ options: opts });
                  }}
                  placeholder={`Option ${oi + 1}`}
                  className="h-7 flex-1 text-[12px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    update({ options: item.options.filter((_, i) => i !== oi) })
                  }
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              onClick={() => update({ options: [...item.options, ""] })}
            >
              <PlusIcon className="size-3" />
              Add option
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SectionEditor sub-component
// ============================================================

interface SectionEditorProps {
  section: LocalSection;
  index: number;
  onChange: (updated: LocalSection) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function SectionEditor({
  section,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SectionEditorProps) {
  const update = (patch: Partial<LocalSection>) => onChange({ ...section, ...patch });

  const addItem = () =>
    update({ items: [...section.items, emptyItem()] });

  // Swap an item with its neighbour (reorder within this section).
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= section.items.length) return;
    const items = [...section.items];
    [items[from], items[to]] = [items[to], items[from]];
    update({ items });
  };

  const totalItems = section.items.length;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Input
          value={section.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={`Section ${index + 1} title`}
          className="h-8 flex-1 text-[13px] font-medium"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
            aria-label="Move section up"
          >
            <ChevronUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
            aria-label="Move section down"
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove section"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>

      {/* Items */}
      <div className="space-y-2 pl-1">
        {section.items.map((item, ii) => (
          <ItemEditor
            key={item._key}
            item={item}
            onChange={(updated) => {
              const items = [...section.items];
              items[ii] = updated;
              update({ items });
            }}
            onRemove={() =>
              update({ items: section.items.filter((_, i) => i !== ii) })
            }
            onMoveUp={() => moveItem(ii, ii - 1)}
            onMoveDown={() => moveItem(ii, ii + 1)}
            isFirst={ii === 0}
            isLast={ii === section.items.length - 1}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-[12px] text-muted-foreground"
        onClick={addItem}
      >
        <PlusIcon className="size-3.5" />
        Add item
      </Button>
    </div>
  );
}

// ============================================================
// PackageBuilder — main component
// ============================================================

export function PackageBuilder({ vendors, categories, initial, defaultVendorId }: PackageBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const pkgId = initial?.id;

  // ── Form state ──
  const prefillVendorId = initial?.vendorId ?? defaultVendorId ?? "";
  const [vendorId, setVendorId] = React.useState(prefillVendorId);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [category, setCategory] = React.useState(
    initial?.category ??
      (defaultVendorId
        ? (vendors.find((v) => v.id === defaultVendorId)?.categories[0] ?? "")
        : "")
  );
  const [status, setStatus] = React.useState(initial?.status ?? "DRAFT");
  // Customer price (mirrors legacy `price`). customerPrice falls back to price.
  const [price, setPrice] = React.useState<string>(
    initial?.customerPrice != null
      ? String(initial.customerPrice)
      : initial?.price !== undefined
        ? String(initial.price)
        : ""
  );
  const [vendorPrice, setVendorPrice] = React.useState<string>(
    initial?.vendorPrice != null ? String(initial.vendorPrice) : ""
  );
  const [minPax, setMinPax] = React.useState<string>(
    initial?.minPax != null ? String(initial.minPax) : ""
  );
  const [maxDiscountType, setMaxDiscountType] = React.useState<string>(
    initial?.maxDiscountType ?? "NONE"
  );
  const [maxDiscountValue, setMaxDiscountValue] = React.useState<string>(
    initial?.maxDiscountValue != null ? String(initial.maxDiscountValue) : ""
  );
  const [priceUnit, setPriceUnit] = React.useState(
    initial?.priceUnit ?? "PER_PLATE"
  );
  const [description, setDescription] = React.useState(
    initial?.description ?? ""
  );
  const [sections, setSections] = React.useState<LocalSection[]>(
    initial?.sections && initial.sections.length > 0
      ? toLocalSections(initial.sections)
      : [emptySection()]
  );

  // Swap a section with its neighbour. sortOrder is renumbered from the array
  // index on save, so reordering the array is all that's needed to persist.
  const moveSection = (from: number, to: number) => {
    setSections((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  // ── Image state ──
  const [images, setImages] = React.useState<Image[]>(initial?.images ?? []);
  const [coverId, setCoverId] = React.useState<string | null>(
    initial?.coverImageId ?? null
  );
  const [imgUrl, setImgUrl] = React.useState("");
  const [imgPending, startImgTransition] = useTransition();

  // ── Error state ──
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [unmetList, setUnmetList] = React.useState<string[]>([]);

  // ── Derived vendor categories ──
  const selectedVendor = vendors.find((v) => v.id === vendorId) ?? null;
  const allowedCategories =
    selectedVendor?.categories && selectedVendor.categories.length > 0
      ? categories.filter((c) => selectedVendor.categories.includes(c.key))
      : categories;

  // When vendor changes, reset category to first allowed
  const handleVendorChange = (vid: string) => {
    setVendorId(vid);
    const v = vendors.find((vv) => vv.id === vid);
    if (v && v.categories.length > 0) {
      setCategory(v.categories[0]);
    }
    setFieldErrors((prev) => ({ ...prev, vendorId: "", category: "" }));
  };

  // ── Readiness check (mirrors server R5) ──
  const priceNum = Number(price);
  const totalItems = sections.reduce((a, s) => a + s.items.length, 0);
  const isReady =
    vendorId.trim() !== "" &&
    name.trim() !== "" &&
    !isNaN(priceNum) &&
    priceNum >= 0 &&
    priceUnit !== "" &&
    totalItems > 0;

  const readinessHints: string[] = [];
  if (!vendorId) readinessHints.push("select a vendor");
  if (!name.trim()) readinessHints.push("name the package");
  if (!price || isNaN(priceNum) || priceNum < 0) readinessHints.push("set a price");
  if (totalItems === 0) readinessHints.push("add at least one item");

  // ── Cover url for preview ──
  const coverUrl = coverId
    ? (images.find((i) => i.id === coverId)?.url ?? null)
    : (images[0]?.url ?? null);

  // ── Live preview data ──
  const previewData = buildPreview(
    vendorId,
    selectedVendor?.name ?? "",
    category,
    status,
    name,
    priceNum,
    priceUnit,
    description,
    coverUrl,
    sections
  );

  // ── Image actions (edit mode only) ──
  const handleAddImage = () => {
    if (!pkgId || !imgUrl.trim()) return;
    startImgTransition(async () => {
      const res = await addPackageImage(pkgId, imgUrl.trim());
      if (res.success) {
        toast.success("Image added");
        setImgUrl("");
        // Re-fetch images by optimistic update: push a placeholder until reload
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Multiple local files → base64 data-URLs → addPackageImage (app convention).
  const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // ~1.5MB guard to keep DB rows sane
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!pkgId || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    startImgTransition(async () => {
      let added = 0;
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" is not an image`);
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`"${file.name}" is too large (max 1.5MB)`);
          continue;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const res = await addPackageImage(pkgId, dataUrl);
          if (res.success) added++;
          else toast.error(res.error);
        } catch {
          toast.error(`Failed to read "${file.name}"`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (added > 0) {
        toast.success(`${added} image${added === 1 ? "" : "s"} uploaded`);
        router.refresh();
      }
    });
  };

  const handleSetCover = (imgId: string) => {
    if (!pkgId) return;
    startImgTransition(async () => {
      const res = await setPackageCover(pkgId, imgId);
      if (res.success) {
        setCoverId(imgId);
        toast.success("Cover updated");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDeleteImage = (imgId: string) => {
    if (!pkgId) return;
    startImgTransition(async () => {
      const res = await deletePackageImage(pkgId, imgId);
      if (res.success) {
        setImages((prev) => prev.filter((i) => i.id !== imgId));
        if (coverId === imgId) {
          const next = images.find((i) => i.id !== imgId);
          setCoverId(next?.id ?? null);
        }
        toast.success("Image removed");
      } else {
        toast.error(res.error);
      }
    });
  };

  // Reorder an image with its neighbour. Images are persisted immediately, so
  // optimistically reorder the local array, then persist via reorderPackageImages
  // and refresh. On failure, revert to the previous order.
  const handleMoveImage = (from: number, to: number) => {
    if (!pkgId) return;
    if (to < 0 || to >= images.length) return;
    const prevImages = images;
    const reordered = [...images];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    setImages(reordered);
    startImgTransition(async () => {
      const res = await reorderPackageImages(
        pkgId,
        reordered.map((i) => i.id)
      );
      if (res.success) {
        router.refresh();
      } else {
        setImages(prevImages);
        toast.error(res.error);
      }
    });
  };

  // ── Save ──
  const handleSave = () => {
    setFieldErrors({});
    setUnmetList([]);

    const discountActive = maxDiscountType !== "NONE";
    const input = {
      vendorId,
      name,
      category,
      status,
      price: priceNum, // legacy mirror
      customerPrice: priceNum,
      vendorPrice: vendorPrice.trim() !== "" ? Number(vendorPrice) : null,
      minPax: minPax.trim() !== "" ? Number(minPax) : null,
      maxDiscountType: discountActive ? maxDiscountType : null,
      maxDiscountValue: discountActive && maxDiscountValue.trim() !== "" ? Number(maxDiscountValue) : null,
      priceUnit,
      currency: "INR",
      description: description || null,
      sections: sections.map((s) => ({
        title: s.title,
        items: s.items.map((it) => ({
          name: it.name,
          type: it.type,
          options: it.options,
          chooseCount: it.chooseCount,
          notes: it.notes || null,
        })),
      })),
    };

    startTransition(async () => {
      const res = pkgId
        ? await updatePackage(pkgId, input)
        : await createPackage(input);

      if (res.success) {
        toast.success(pkgId ? "Package updated" : "Package created");
        const targetId = pkgId ?? (res as { success: true; data: { id: string } }).data.id;
        router.push(`/vendors/packages/${targetId}`);
      } else {
        if (res.error === "CANNOT_ACTIVATE" && res.unmet) {
          setUnmetList(res.unmet);
          toast.error("Cannot activate — see requirements below");
        } else if (res.fields) {
          setFieldErrors(res.fields);
          toast.error(res.error ?? "Validation failed");
        } else {
          toast.error(res.error ?? "Something went wrong");
        }
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ══════════════════════════════════════════════════════
          LEFT — Details + Structure
      ══════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        {/* Basic details card */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">Package details</h2>

          {/* Vendor select */}
          <div className="space-y-1.5">
            <Label htmlFor="vendor" className="text-[13px]">
              Vendor <span className="text-destructive">*</span>
            </Label>
            <Select value={vendorId} onValueChange={handleVendorChange}>
              <SelectTrigger
                id="vendor"
                className={cn(
                  "h-9 text-[13px]",
                  fieldErrors.vendorId && "border-destructive"
                )}
              >
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.vendorId && (
              <p className="text-[12px] text-destructive">{fieldErrors.vendorId}</p>
            )}
          </div>

          {/* Package name */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name" className="text-[13px]">
              Package name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pkg-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g. Premium décor package"
              className={cn(
                "h-9 text-[13px]",
                fieldErrors.name && "border-destructive"
              )}
            />
            {fieldErrors.name && (
              <p className="text-[12px] text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          {/* Category + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-[13px]">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setFieldErrors((prev) => ({ ...prev, category: "" }));
                }}
                disabled={!vendorId}
              >
                <SelectTrigger
                  id="category"
                  className={cn(
                    "h-9 text-[13px]",
                    fieldErrors.category && "border-destructive"
                  )}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {allowedCategories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category && (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.category}
                </p>
              )}
              {!vendorId && (
                <p className="text-[11px] text-muted-foreground">
                  Select a vendor first
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-[13px]">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price + Unit row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-[13px]">
                Customer price (₹) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, price: "" }));
                  }}
                  placeholder="0"
                  className={cn(
                    "h-9 pl-7 text-[13px] tabular-nums",
                    fieldErrors.price && "border-destructive"
                  )}
                />
              </div>
              {fieldErrors.price && (
                <p className="text-[12px] text-destructive">{fieldErrors.price}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price-unit" className="text-[13px]">
                Price unit
              </Label>
              <Select value={priceUnit} onValueChange={setPriceUnit}>
                <SelectTrigger id="price-unit" className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_PACKAGE_PRICE_UNITS.map((u) => (
                    <SelectItem key={u.key} value={u.key}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor price + Min pax row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-price" className="text-[13px]">
                Vendor price (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="vendor-price"
                  type="number"
                  min={0}
                  value={vendorPrice}
                  onChange={(e) => {
                    setVendorPrice(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, vendorPrice: "" }));
                  }}
                  placeholder="Internal cost"
                  className={cn(
                    "h-9 pl-7 text-[13px] tabular-nums",
                    fieldErrors.vendorPrice && "border-destructive"
                  )}
                />
              </div>
              {fieldErrors.vendorPrice && (
                <p className="text-[12px] text-destructive">{fieldErrors.vendorPrice}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min-pax" className="text-[13px]">
                Minimum pax / units
              </Label>
              <Input
                id="min-pax"
                type="number"
                min={0}
                value={minPax}
                onChange={(e) => {
                  setMinPax(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, minPax: "" }));
                }}
                placeholder="e.g. 100"
                className={cn(
                  "h-9 text-[13px] tabular-nums",
                  fieldErrors.minPax && "border-destructive"
                )}
              />
              {fieldErrors.minPax && (
                <p className="text-[12px] text-destructive">{fieldErrors.minPax}</p>
              )}
            </div>
          </div>

          {/* Max discount row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="discount-type" className="text-[13px]">
                Max discount
              </Label>
              <Select value={maxDiscountType} onValueChange={setMaxDiscountType}>
                <SelectTrigger id="discount-type" className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No cap</SelectItem>
                  {VENDOR_MAX_DISCOUNT_TYPES.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discount-value" className="text-[13px]">
                Discount value
              </Label>
              <Input
                id="discount-value"
                type="number"
                min={0}
                max={maxDiscountType === "PERCENT" ? 100 : undefined}
                value={maxDiscountValue}
                disabled={maxDiscountType === "NONE"}
                onChange={(e) => {
                  setMaxDiscountValue(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, maxDiscount: "" }));
                }}
                placeholder={maxDiscountType === "PERCENT" ? "0–100" : "₹ amount"}
                className={cn(
                  "h-9 text-[13px] tabular-nums",
                  fieldErrors.maxDiscount && "border-destructive"
                )}
              />
              {fieldErrors.maxDiscount && (
                <p className="text-[12px] text-destructive">{fieldErrors.maxDiscount}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-[13px]">
              Description
            </Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what's included…"
              rows={3}
              className="resize-none text-[13px]"
            />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">
              Sections &amp; items
            </h2>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {totalItems} total item{totalItems !== 1 ? "s" : ""}
            </span>
          </div>

          {sections.map((section, si) => (
            <SectionEditor
              key={section._key}
              section={section}
              index={si}
              onChange={(updated) => {
                const next = [...sections];
                next[si] = updated;
                setSections(next);
              }}
              onRemove={() =>
                setSections(sections.filter((_, i) => i !== si))
              }
              onMoveUp={() => moveSection(si, si - 1)}
              onMoveDown={() => moveSection(si, si + 1)}
              isFirst={si === 0}
              isLast={si === sections.length - 1}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            onClick={() => setSections([...sections, emptySection()])}
          >
            <PlusIcon className="size-3.5" />
            Add section
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT — Images + Preview
      ══════════════════════════════════════════════════════ */}
      <div className="space-y-5">
        {/* Images card */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">Images</h2>

          {pkgId ? (
            <>
              {/* Upload local files (multiple) */}
              <div className="space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-1.5 text-[12px]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imgPending}
                >
                  <ImageIcon className="size-3.5" />
                  Upload images
                </Button>
                <p className="text-[11px] text-muted-foreground/70">
                  Up to 1.5MB each. You can select several at once.
                </p>
              </div>

              {/* Or add by URL */}
              <div className="flex gap-2">
                <Input
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://… image URL"
                  className="h-8 flex-1 text-[12px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddImage();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={handleAddImage}
                  disabled={imgPending || !imgUrl.trim()}
                >
                  Add
                </Button>
              </div>

              {/* Thumbnail grid */}
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, imgIdx) => {
                    const isCover = img.id === coverId;
                    const isFirstImg = imgIdx === 0;
                    const isLastImg = imgIdx === images.length - 1;
                    return (
                      <div
                        key={img.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {/* Cover badge */}
                        {isCover && (
                          <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            <StarIcon className="size-2.5 fill-current" />
                            Cover
                          </div>
                        )}
                        {/* Hover actions */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleMoveImage(imgIdx, imgIdx - 1)}
                            disabled={imgPending || isFirstImg}
                            className="rounded-full bg-white/90 p-1.5 text-foreground hover:bg-white disabled:opacity-40"
                            title="Move earlier"
                          >
                            <ChevronLeftIcon className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveImage(imgIdx, imgIdx + 1)}
                            disabled={imgPending || isLastImg}
                            className="rounded-full bg-white/90 p-1.5 text-foreground hover:bg-white disabled:opacity-40"
                            title="Move later"
                          >
                            <ChevronRightIcon className="size-3" />
                          </button>
                          {!isCover && (
                            <button
                              type="button"
                              onClick={() => handleSetCover(img.id)}
                              disabled={imgPending}
                              className="rounded-full bg-white/90 p-1.5 text-foreground hover:bg-white"
                              title="Set as cover"
                            >
                              <StarIcon className="size-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.id)}
                            disabled={imgPending}
                            className="rounded-full bg-white/90 p-1.5 text-destructive hover:bg-white"
                            title="Remove image"
                          >
                            <Trash2Icon className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30">
                  <p className="text-[12px] text-muted-foreground">
                    No images yet — add one above
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center">
              <ImageIcon className="mx-auto mb-2 size-6 text-muted-foreground/40" />
              <p className="text-[12px] text-muted-foreground">
                Images can be added after first save.
              </p>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            Live preview
          </h2>
          <PackageCard data={previewData} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FOOTER — Readiness + Actions (spans full width)
      ══════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 space-y-3">
        <Separator />

        {/* Unmet CANNOT_ACTIVATE conditions */}
        {unmetList.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-destructive">
              <AlertCircleIcon className="size-4" />
              Cannot activate — requirements not met:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[12px] text-destructive/80">
              {unmetList.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Readiness indicator */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            {isReady ? (
              <>
                <CheckIcon className="size-4 text-success" />
                <span className="text-success font-medium">Ready to save.</span>
              </>
            ) : (
              <>
                <AlertCircleIcon className="size-4 text-warning" />
                <span>
                  To save: {readinessHints.join(", ")}.
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[13px]"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 text-[13px]"
              onClick={handleSave}
              disabled={isPending || !isReady}
            >
              {isPending ? "Saving…" : pkgId ? "Update package" : "Create package"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
