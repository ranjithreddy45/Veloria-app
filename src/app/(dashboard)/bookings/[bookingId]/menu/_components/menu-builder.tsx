"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  MinusIcon,
  Loader2Icon,
  TrashIcon,
  UtensilsIcon,
  UsersIcon,
  IndianRupeeIcon,
  SaveIcon,
} from "lucide-react";

import { saveBookingMenu } from "@/actions/menu.actions";
import { MENU_CATEGORIES } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ============================================================
// Types
// ============================================================

interface SerializedMenuItem {
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

interface SerializedBookingMenuSelection {
  id: string;
  quantity: number;
  customPrice: number | null;
  order: number;
  menuItemId: string;
  menuItem: SerializedMenuItem;
}

interface SerializedBookingMenu {
  id: string;
  guestCount: number;
  pricePerHead: number;
  totalPrice: number;
  specialInstructions: string | null;
  selections: SerializedBookingMenuSelection[];
}

interface Selection {
  menuItemId: string;
  quantity: number;
  customPrice?: number;
  menuItem: SerializedMenuItem;
}

interface MenuBuilderProps {
  bookingId: string;
  bookingGuestCount: number;
  bookingMenu: SerializedBookingMenu | null;
  menuItems: SerializedMenuItem[];
}

// ============================================================
// MenuBuilder Component
// ============================================================

export function MenuBuilder({
  bookingId,
  bookingGuestCount,
  bookingMenu,
  menuItems,
}: MenuBuilderProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  // State
  const [guestCount, setGuestCount] = React.useState(
    bookingMenu?.guestCount ?? bookingGuestCount
  );
  const [specialInstructions, setSpecialInstructions] = React.useState(
    bookingMenu?.specialInstructions ?? ""
  );
  const [selections, setSelections] = React.useState<Selection[]>(() => {
    if (bookingMenu?.selections) {
      return bookingMenu.selections.map((sel) => ({
        menuItemId: sel.menuItemId,
        quantity: sel.quantity,
        customPrice: sel.customPrice ?? undefined,
        menuItem: sel.menuItem,
      }));
    }
    return [];
  });

  const [activeCategory, setActiveCategory] = React.useState<string>("All");

  // Derived values
  const pricePerHead = React.useMemo(() => {
    return selections.reduce((sum, sel) => {
      const price = sel.customPrice ?? sel.menuItem.pricePerHead;
      return sum + price * sel.quantity;
    }, 0);
  }, [selections]);

  const totalPrice = pricePerHead * guestCount;

  const selectedItemIds = React.useMemo(
    () => new Set(selections.map((s) => s.menuItemId)),
    [selections]
  );

  // Group menu items by category
  const categorizedItems = React.useMemo(() => {
    const grouped: Record<string, SerializedMenuItem[]> = {};
    for (const item of menuItems) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    return grouped;
  }, [menuItems]);

  // Filter items by active category
  const filteredItems = React.useMemo(() => {
    if (activeCategory === "All") return menuItems;
    return menuItems.filter((item) => item.category === activeCategory);
  }, [menuItems, activeCategory]);

  // Available categories that have items
  const availableCategories = React.useMemo(() => {
    const cats = [...new Set(menuItems.map((item) => item.category))];
    // Sort by MENU_CATEGORIES order
    return cats.sort(
      (a, b) =>
        MENU_CATEGORIES.indexOf(a as typeof MENU_CATEGORIES[number]) -
        MENU_CATEGORIES.indexOf(b as typeof MENU_CATEGORIES[number])
    );
  }, [menuItems]);

  // Handlers
  const addItem = (item: SerializedMenuItem) => {
    setSelections((prev) => [
      ...prev,
      { menuItemId: item.id, quantity: 1, menuItem: item },
    ]);
  };

  const removeItem = (menuItemId: string) => {
    setSelections((prev) => prev.filter((s) => s.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.menuItemId === menuItemId) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  };

  const handleSave = async () => {
    if (selections.length === 0) {
      toast.error("Please select at least one menu item");
      return;
    }

    if (guestCount < 1) {
      toast.error("Guest count must be at least 1");
      return;
    }

    setIsPending(true);
    try {
      const result = await saveBookingMenu(bookingId, {
        guestCount,
        pricePerHead,
        specialInstructions: specialInstructions || "",
        selections: selections.map((sel) => ({
          menuItemId: sel.menuItemId,
          quantity: sel.quantity,
          customPrice: sel.customPrice,
        })),
      });

      if (result.success) {
        toast.success("Booking menu saved successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  // Count items per category in selections
  const selectionCountByCategory = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sel of selections) {
      const cat = sel.menuItem.category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [selections]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Menu Item Browser (2 cols) */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsIcon className="size-5" />
              Menu Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeCategory}
              onValueChange={setActiveCategory}
            >
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="All" className="text-xs">
                  All ({menuItems.length})
                </TabsTrigger>
                {availableCategories.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="text-xs">
                    {cat} ({categorizedItems[cat]?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-4">
                {filteredItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    No items found in this category.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? "border-primary/50 bg-primary/5"
                              : "hover:border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-muted-foreground text-xs line-clamp-2 mt-0.5">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                <Badge variant="outline" className="text-xs">
                                  {item.category}
                                </Badge>
                                {item.cuisine && (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.cuisine}
                                  </Badge>
                                )}
                                {item.dietaryTags.slice(0, 2).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">
                                {formatINR(item.pricePerHead)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                per head
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            {isSelected ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => removeItem(item.id)}
                              >
                                <TrashIcon className="mr-1 size-3" />
                                Remove
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="text-xs"
                                onClick={() => addItem(item)}
                              >
                                <PlusIcon className="mr-1 size-3" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Right: Running Total Sidebar (1 col) */}
      <div className="space-y-4">
        {/* Guest Count */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersIcon className="size-4" />
              Guest Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) =>
                setGuestCount(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
          </CardContent>
        </Card>

        {/* Selected Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UtensilsIcon className="size-4" />
                Selected Items
              </span>
              <Badge variant="secondary">{selections.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selections.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">
                No items selected yet. Browse the catalog and add items.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Group by category */}
                {availableCategories
                  .filter((cat) => selectionCountByCategory[cat])
                  .map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        {cat}
                      </p>
                      {selections
                        .filter((s) => s.menuItem.category === cat)
                        .map((sel) => {
                          const price =
                            sel.customPrice ?? sel.menuItem.pricePerHead;
                          return (
                            <div
                              key={sel.menuItemId}
                              className="flex items-center justify-between gap-2 rounded-md border p-2 mb-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {sel.menuItem.name}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {formatINR(price)} /head
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="outline"
                                  size="icon-xs"
                                  onClick={() =>
                                    updateQuantity(sel.menuItemId, -1)
                                  }
                                >
                                  <MinusIcon className="size-3" />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium">
                                  {sel.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon-xs"
                                  onClick={() =>
                                    updateQuantity(sel.menuItemId, 1)
                                  }
                                >
                                  <PlusIcon className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-destructive ml-1"
                                  onClick={() => removeItem(sel.menuItemId)}
                                >
                                  <TrashIcon className="size-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupeeIcon className="size-4" />
              Price Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per head</span>
              <span className="font-medium">{formatINR(pricePerHead)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Guest count</span>
              <span className="font-medium">{guestCount}</span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{formatINR(totalPrice)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Special Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Special Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any dietary restrictions, allergies, or special requests..."
              rows={3}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={isPending || selections.length === 0}
        >
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SaveIcon className="mr-2 size-4" />
          )}
          Save Menu
        </Button>
      </div>
    </div>
  );
}
