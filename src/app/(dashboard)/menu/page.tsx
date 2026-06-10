import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getMenuItems } from "@/actions/menu.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { MenuItemsTable } from "./_components/menu-items-table";

export const metadata: Metadata = { title: "Menu Items" };

// ============================================================
// Menu Items List Page
// ============================================================

export default async function MenuPage() {
  const result = await getMenuItems();

  const items = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Items"
        help={<PageHelp id="menu" />}
        description="Manage your catering menu catalog."
      >
        <Button asChild>
          <Link href="/menu/new">
            <PlusIcon className="mr-2 size-4" />
            New Item
          </Link>
        </Button>
      </PageHeader>
      <MenuItemsTable data={items} />
    </div>
  );
}
