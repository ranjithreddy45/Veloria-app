"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/actions/report.actions";

// Each report tab pulls in recharts (~250KB). Load only the tab the user opens
// instead of bundling all 8 + recharts on first paint.
const tabLoading = () => <Skeleton className="h-[420px] w-full rounded-lg" />;
const RevenueReports = dynamic(() => import("./revenue-reports").then((m) => m.RevenueReports), { loading: tabLoading });
const BookingReports = dynamic(() => import("./booking-reports").then((m) => m.BookingReports), { loading: tabLoading });
const PipelineReports = dynamic(() => import("./pipeline-reports").then((m) => m.PipelineReports), { loading: tabLoading });
const FinancialReports = dynamic(() => import("./financial-reports").then((m) => m.FinancialReports), { loading: tabLoading });
const ClientReports = dynamic(() => import("./client-reports").then((m) => m.ClientReports), { loading: tabLoading });
const VendorReports = dynamic(() => import("./vendor-reports").then((m) => m.VendorReports), { loading: tabLoading });
const TaxReports = dynamic(() => import("./tax-reports").then((m) => m.TaxReports), { loading: tabLoading });
const OperationsReports = dynamic(() => import("./operations-reports").then((m) => m.OperationsReports), { loading: tabLoading });

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
