"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { menuItemSchema, type MenuItemInput } from "@/schemas/menu.schema";
import { createMenuItem, updateMenuItem } from "@/actions/menu.actions";
import { MENU_CATEGORIES, MENU_CUISINES, DIETARY_TAGS } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// MenuItemForm Props
// ============================================================

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  dietaryTags: string[];
  pricePerHead: number;
  imageUrl: string | null;
  isActive: boolean;
}

interface MenuItemFormProps {
  menuItem?: MenuItemData;
}

// ============================================================
// MenuItemForm Component
// ============================================================

export function MenuItemForm({ menuItem }: MenuItemFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!menuItem;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema) as any,
    defaultValues: {
      name: menuItem?.name ?? "",
      description: menuItem?.description ?? "",
      category: (menuItem?.category as MenuItemInput["category"]) ?? undefined,
      cuisine: (menuItem?.cuisine as MenuItemInput["cuisine"]) ?? "",
      dietaryTags: (menuItem?.dietaryTags as MenuItemInput["dietaryTags"]) ?? [],
      pricePerHead: menuItem?.pricePerHead ?? 0,
      imageUrl: menuItem?.imageUrl ?? "",
      isActive: menuItem?.isActive ?? true,
    },
  });

  async function onSubmit(data: MenuItemInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateMenuItem(menuItem.id, data)
        : await createMenuItem(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Menu item updated successfully"
            : "Menu item created successfully"
        );
        router.push("/menu");
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
                    <Input placeholder="e.g. Paneer Tikka" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pricePerHead"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Per Head *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
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
                      {MENU_CATEGORIES.map((cat) => (
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
            <FormField
              control={form.control}
              name="cuisine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuisine</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select cuisine" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {MENU_CUISINES.map((cuisine) => (
                        <SelectItem key={cuisine} value={cuisine}>
                          {cuisine}
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
                        placeholder="Brief description of the menu item"
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

        {/* Dietary Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Dietary Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="dietaryTags"
              render={() => (
                <FormItem>
                  <FormDescription>
                    Select all applicable dietary tags for this menu item.
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-3">
                    {DIETARY_TAGS.map((tag) => (
                      <FormField
                        key={tag}
                        control={form.control}
                        name="dietaryTags"
                        render={({ field }) => {
                          const currentTags = field.value ?? [];
                          return (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={currentTags.includes(tag as MenuItemInput["dietaryTags"][number])}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...currentTags, tag]);
                                    } else {
                                      field.onChange(
                                        currentTags.filter((t: string) => t !== tag)
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {tag}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0 pt-8">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Active (available for selection in booking menus)
                  </FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Menu Item" : "Create Menu Item"}
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
