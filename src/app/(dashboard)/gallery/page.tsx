import type { Metadata } from "next";

import { getGalleryItems } from "@/actions/gallery.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { GalleryGrid } from "./_components/gallery-grid";

export const metadata: Metadata = { title: "Gallery" };

// ============================================================
// Gallery List Page
// ============================================================

export default async function GalleryPage() {
  const [itemsResult, venuesResult] = await Promise.all([
    getGalleryItems(),
    getVenues(),
  ]);

  const items = itemsResult.success ? itemsResult.data.data : [];
  const venues = venuesResult.success ? venuesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`Brand · ${items.length} ${items.length === 1 ? "asset" : "assets"}`}
        title="Gallery"
        help={<PageHelp id="gallery" />}
        description="Manage photos and videos for events and venues."
      />
      <GalleryGrid
        data={items}
        venues={venues}
      />
    </div>
  );
}
