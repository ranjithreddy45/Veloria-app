"use client";

import * as React from "react";
import Link from "next/link";
import { PlusIcon, TagsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorsPanel } from "./vendors-panel";
import { VendorFormDialog } from "./vendor-form-dialog";
import { PackagesPanel } from "./packages-panel";
import { CategoryAdminDialog } from "./category-admin-dialog";

// ============================================================
// Types
// ============================================================

export type CategoryOption = { key: string; label: string };
export type VenueOption = { id: string; name: string; capacity?: number | null };

export type VendorRow = {
  id: string;
  name: string;
  categories: string[];
  category: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  empanelmentStatus: string | null;
  qualityScore: number | null;
  isArchived: boolean;
  packageCount: number;
  vendorType: string | null;
  venueIds: string[];
  allVenues: boolean;
};

export type PackageCardData = {
  id: string;
  name: string;
  category: string;
  status: string;
  price: number;
  priceUnit: string;
  currency: string;
  description: string | null;
  vendor: { id: string; name: string };
  coverUrl: string | null;
  sectionCount: number;
  itemCount: number;
};

interface VendorModuleProps {
  vendors: VendorRow[];
  vendorTotal: number;
  packages: PackageCardData[];
  packageTotal: number;
  categories: CategoryOption[];
  venues: VenueOption[];
  canManageCategories: boolean;
}

// ============================================================
// VendorModule
// ============================================================

export function VendorModule({
  vendors,
  vendorTotal,
  packages,
  packageTotal,
  categories,
  venues,
  canManageCategories,
}: VendorModuleProps) {
  const [activeTab, setActiveTab] = React.useState("vendors");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearch("");
    setCategory("all");
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* ── Toolbar ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab triggers */}
        <TabsList className="h-9 self-start">
          <TabsTrigger value="vendors" className="text-[13px]">
            Vendors
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {vendorTotal}
            </span>
          </TabsTrigger>
          <TabsTrigger value="packages" className="text-[13px]">
            Packages
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {packageTotal}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Search + category filter + action */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={activeTab === "vendors" ? "Search vendors…" : "Search packages…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 text-[13px]"
          />

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-40 text-[13px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canManageCategories && (
            <CategoryAdminDialog
              trigger={
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]">
                  <TagsIcon className="size-3.5" />
                  Categories
                </Button>
              }
            />
          )}

          {activeTab === "vendors" ? (
            <VendorFormDialog
              categories={categories}
              venues={venues}
              trigger={
                <Button size="sm" className="h-9 gap-1.5 text-[13px]">
                  <PlusIcon className="size-3.5" strokeWidth={2.5} />
                  Add vendor
                </Button>
              }
            />
          ) : (
            <Button asChild size="sm" className="h-9 gap-1.5 text-[13px]">
              <Link href="/vendors/packages/new">
                <PlusIcon className="size-3.5" strokeWidth={2.5} />
                Create package
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Vendors tab ── */}
      <TabsContent value="vendors">
        <VendorsPanel
          vendors={vendors}
          search={search}
          category={category}
          categories={categories}
          venues={venues}
        />
      </TabsContent>

      {/* ── Packages tab ── */}
      <TabsContent value="packages">
        <PackagesPanel
          initial={packages}
          total={packageTotal}
          search={search}
          category={category}
          vendors={vendors}
        />
      </TabsContent>
    </Tabs>
  );
}
