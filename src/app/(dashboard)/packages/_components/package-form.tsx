"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  GripVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";

import { packageSchema, type PackageInput } from "@/schemas/package.schema";
import { createPackage, updatePackage } from "@/actions/package.actions";
import { EVENT_TYPES } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

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
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ============================================================
// PackageForm Props
// ============================================================

interface PackageData {
  id: string;
  name: string;
  description: string | null;
  eventType: string | null;
  basePrice: number;
  tier: "BASIC" | "STANDARD" | "PREMIUM" | "CUSTOM";
  isActive: boolean;
  imageUrl: string | null;
  items: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    quantity: number;
    unitPrice: number;
    isIncluded: boolean;
    order: number;
  }[];
}

interface PackageFormProps {
  eventPackage?: PackageData;
}

// ============================================================
// Tier Options
// ============================================================

const TIER_OPTIONS = [
  { value: "BASIC", label: "Basic" },
  { value: "STANDARD", label: "Standard" },
  { value: "PREMIUM", label: "Premium" },
  { value: "CUSTOM", label: "Custom" },
] as const;

// ============================================================
// PackageForm Component
// ============================================================

export function PackageForm({ eventPackage }: PackageFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!eventPackage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<PackageInput>({
    resolver: zodResolver(packageSchema) as any,
    defaultValues: {
      name: eventPackage?.name ?? "",
      description: eventPackage?.description ?? "",
      eventType: eventPackage?.eventType ?? "",
      basePrice: eventPackage?.basePrice ?? 0,
      tier: eventPackage?.tier ?? "STANDARD",
      isActive: eventPackage?.isActive ?? true,
      imageUrl: eventPackage?.imageUrl ?? "",
      items: eventPackage?.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? "",
        category: item.category ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isIncluded: item.isIncluded,
        order: item.order,
      })) ?? [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate totals
  const watchedItems = form.watch("items");
  const includedTotal = React.useMemo(() => {
    return (watchedItems ?? [])
      .filter((item) => item.isIncluded)
      .reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  }, [watchedItems]);

  const allItemsTotal = React.useMemo(() => {
    return (watchedItems ?? [])
      .reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  }, [watchedItems]);

  function addItem() {
    append({
      name: "",
      description: "",
      category: "",
      quantity: 1,
      unitPrice: 0,
      isIncluded: true,
      order: fields.length,
    });
  }

  function moveItemUp(index: number) {
    if (index > 0) {
      move(index, index - 1);
    }
  }

  function moveItemDown(index: number) {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  }

  async function onSubmit(data: PackageInput) {
    setIsPending(true);
    try {
      // Set order based on current position
      const orderedData = {
        ...data,
        items: data.items.map((item, index) => ({
          ...item,
          order: index,
        })),
      };

      const result = isEditing
        ? await updatePackage(eventPackage.id, orderedData)
        : await createPackage(orderedData);

      if (result.success) {
        toast.success(
          isEditing
            ? "Package updated successfully"
            : "Package created successfully"
        );
        router.push(
          isEditing ? `/packages/${eventPackage.id}` : "/packages"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Package Details */}
        <Card>
          <CardHeader>
            <CardTitle>Package Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Package Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Wedding Premium Package" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this package includes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package Tier *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Price (INR) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="50000"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <Label className="!mt-0 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                    Package is active and visible
                  </Label>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Package Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Package Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <PlusIcon className="mr-2 size-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  No items added yet. Add items to build your package.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <PlusIcon className="mr-2 size-4" />
                  Add First Item
                </Button>
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVerticalIcon className="size-4 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Item {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => moveItemUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUpIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => moveItemDown(index)}
                        disabled={index === fields.length - 1}
                      >
                        <ArrowDownIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => remove(index)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Decoration" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.category`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input placeholder="Decor" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 1)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price (INR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Optional description..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.isIncluded`}
                      render={({ field }) => (
                        <FormItem className="flex items-end gap-3 pb-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              size="sm"
                            />
                          </FormControl>
                          <Label
                            className="!mt-0 cursor-pointer text-sm"
                            onClick={() => field.onChange(!field.value)}
                          >
                            {field.value ? "Included" : "Optional"}
                          </Label>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Item Subtotal */}
                  <div className="mt-3 flex justify-end">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Subtotal:{" "}
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {formatINR(
                          (watchedItems?.[index]?.quantity || 0) *
                            (watchedItems?.[index]?.unitPrice || 0)
                        )}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Totals */}
            {fields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Included Items Total
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatINR(includedTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      All Items Total
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatINR(allItemsTotal)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Base Price
                    </span>
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {formatINR(form.watch("basePrice"))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Package" : "Create Package"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
