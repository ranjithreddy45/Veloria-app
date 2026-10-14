import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/** An owner login with no VenueOwnerAccess rows yet. */
export function NoVenues({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title="Your venues" module={false} />
      <Card className="py-0">
        <CardContent className="p-0">
          <EmptyState
            icon={<Building2 />}
            title="No venues yet"
            description="No venues are linked to your login yet. Please contact Veloria Grand."
          />
        </CardContent>
      </Card>
    </div>
  );
}
