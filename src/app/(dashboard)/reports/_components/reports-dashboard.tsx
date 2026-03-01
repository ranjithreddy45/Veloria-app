"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/actions/report.actions";
import { RevenueReports } from "./revenue-reports";
import { BookingReports } from "./booking-reports";
import { PipelineReports } from "./pipeline-reports";
import { FinancialReports } from "./financial-reports";
import { ClientReports } from "./client-reports";
import { VendorReports } from "./vendor-reports";
import { TaxReports } from "./tax-reports";
import { OperationsReports } from "./operations-reports";

// ============================================================
// Date Range Options
// ============================================================

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "12m", label: "12 Months" },
];

// ============================================================
// Reports Dashboard Component
// ============================================================

export function ReportsDashboard() {
  const [range, setRange] = React.useState<DateRange>("12m");

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        {DATE_RANGES.map((dr) => (
          <Button
            key={dr.value}
            size="sm"
            variant={range === dr.value ? "default" : "outline"}
            className={cn(
              range === dr.value && "bg-indigo-600 hover:bg-indigo-700"
            )}
            onClick={() => setRange(dr.value)}
          >
            {dr.label}
          </Button>
        ))}
      </div>

      {/* Tabs for report sections */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueReports range={range} />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingReports range={range} />
        </TabsContent>
        <TabsContent value="pipeline">
          <PipelineReports range={range} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialReports range={range} />
        </TabsContent>
        <TabsContent value="clients">
          <ClientReports range={range} />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorReports range={range} />
        </TabsContent>
        <TabsContent value="tax">
          <TaxReports range={range} />
        </TabsContent>
        <TabsContent value="operations">
          <OperationsReports range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
