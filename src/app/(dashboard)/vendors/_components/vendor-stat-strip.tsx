// ============================================================
// VendorStatStrip — colorful KPI strip for the Vendors landing. Pure
// presentation: counts are computed from the already-loaded vendor rows, so it
// adds no new data fetching. Mirrors the StatTile strip used on Leads/Contacts.
// ============================================================

import {
  StoreIcon,
  CircleCheckIcon,
  StarIcon,
  CalendarCheckIcon,
} from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";

interface VendorStatRow {
  status: string;
  rating: number;
  totalBookings: number;
}

export function VendorStatStrip({ vendors }: { vendors: VendorStatRow[] }) {
  const total = vendors.length;
  const active = vendors.filter((v) => v.status === "ACTIVE").length;
  const totalBookings = vendors.reduce((sum, v) => sum + (v.totalBookings || 0), 0);
  const rated = vendors.filter((v) => v.rating > 0);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, v) => sum + v.rating, 0) / rated.length
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Total vendors"
        value={<span className="tabular-nums">{total}</span>}
        accent="indigo"
        icon={<StoreIcon className="size-4" />}
      />
      <StatTile
        label="Active"
        value={<span className="tabular-nums">{active}</span>}
        accent="emerald"
        icon={<CircleCheckIcon className="size-4" />}
        sub={total > 0 ? `${Math.round((active / total) * 100)}% of marketplace` : undefined}
      />
      <StatTile
        label="Avg rating"
        value={
          <span className="tabular-nums">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"}
          </span>
        }
        accent="amber"
        icon={<StarIcon className="size-4" />}
        sub={rated.length > 0 ? `${rated.length} rated` : undefined}
      />
      <StatTile
        label="Bookings"
        value={<span className="tabular-nums">{totalBookings}</span>}
        accent="violet"
        icon={<CalendarCheckIcon className="size-4" />}
      />
    </div>
  );
}
