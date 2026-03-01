import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MenuItemForm } from "../_components/menu-item-form";

export const metadata: Metadata = { title: "New Menu Item" };

// ============================================================
// Create Menu Item Page
// ============================================================

export default function NewMenuItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Menu Item"
        description="Add a new item to the catering menu catalog."
      />
      <div className="mx-auto max-w-3xl">
        <MenuItemForm />
      </div>
    </div>
  );
}
