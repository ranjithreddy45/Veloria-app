import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuItem } from "@/actions/menu.actions";
import { PageHeader } from "@/components/layout/page-header";
import { MenuItemForm } from "../../_components/menu-item-form";

export const metadata: Metadata = { title: "Edit Menu Item" };

// ============================================================
// Edit Menu Item Page
// ============================================================

interface EditMenuItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function EditMenuItemPage({
  params,
}: EditMenuItemPageProps) {
  const { itemId } = await params;
  const result = await getMenuItem(itemId);

  if (!result.success || !result.data) {
    notFound();
  }

  const menuItem = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Menu Item"
        description={`Editing ${menuItem.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <MenuItemForm menuItem={menuItem} />
      </div>
    </div>
  );
}
