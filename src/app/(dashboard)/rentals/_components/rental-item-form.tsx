"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { rentalItemSchema, type RentalItemInput } from "@/schemas/rental.schema";
import { createRentalItem, updateRentalItem } from "@/actions/rental.actions";
import { RENTAL_CATEGORIES } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// ============================================================
// RentalItemForm Props
// ============================================================

interface RentalItemData {
  id: string;
  name: string;
  category: string;
  description: string | null;
  dailyRate: number;
  weeklyRate: number | null;
  quantity: number;
  availableQty: number;
  condition: string | null;
  imageUrl: string | null;
}

interface RentalItemFormProps {
  item?: RentalItemData;
}

// ============================================================
// RentalItemForm Component
// ============================================================

export function RentalItemForm({ item }: RentalItemFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!item;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<RentalItemInput>({
    resolver: zodResolver(rentalItemSchema) as any,
    defaultValues: {
      name: item?.name ?? "",
      category: (item?.category as RentalItemInput["category"]) ?? undefined,
      description: item?.description ?? "",
      dailyRate: item?.dailyRate ?? undefined,
      weeklyRate: item?.weeklyRate ?? undefined,
      quantity: item?.quantity ?? undefined,
      availableQty: item?.availableQty ?? undefined,
      condition: item?.condition ?? "",
      imageUrl: item?.imageUrl ?? "",
    },
  });

  async function onSubmit(data: RentalItemInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateRentalItem(item.id, data)
        : await createRentalItem(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Rental item updated successfully"
            : "Rental item created successfully"
        );
        router.push(
          isEditing ? `/rentals/${item.id}` : "/rentals"
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
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 20x40 White Tent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RENTAL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the rental item..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="dailyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Rate (INR) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weeklyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weekly Rate (INR)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Optional discount rate"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Inventory & Condition */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory & Condition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 10"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="availableQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Available Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 8"
                      {...field}
                      // On edit the available count is derived server-side from
                      // total quantity minus units currently out on active
                      // rentals; any value typed here would be ignored, so the
                      // field is read-only to avoid misleading the user.
                      readOnly={isEditing}
                      disabled={isEditing}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                    />
                  </FormControl>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      Recalculated automatically from total quantity and active
                      rentals.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Excellent, Good, Fair" {...field} />
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
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Rental Item" : "Create Rental Item"}
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
