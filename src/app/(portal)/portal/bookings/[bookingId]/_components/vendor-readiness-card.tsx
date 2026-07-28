"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface VendorReadinessCardProps {
  confirmed: number;
  total: number;
}

export function VendorReadinessCard({ confirmed, total }: VendorReadinessCardProps) {
  if (total === 0) return null;

  const percent = Math.round((confirmed / total) * 100);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="size-4 text-primary" />
          Vendor Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {confirmed} of {total} vendors confirmed
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {percent}%
            </span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
