"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SparklesIcon, FlameIcon } from "lucide-react";

import { getAIDemandForecast } from "@/actions/forecast.actions";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ForecastChart } from "./forecast-chart";
import { DemandHeatmap } from "./demand-heatmap";
import { ForecastTable } from "./forecast-table";

// ============================================================
// Types
// ============================================================

interface ForecastEntry {
  id: string;
  month: string;
  year: number;
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number;
  generatedAt: string;
}

interface ForecastPrediction {
  month: string;
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number;
  factors: string[];
}

interface HeatmapVenue {
  venueId: string;
  venueName: string;
  months: {
    month: string;
    demand: "high" | "medium" | "low";
    bookings: number;
  }[];
}

interface Venue {
  id: string;
  name: string;
}

interface ForecastDashboardProps {
  entries: ForecastEntry[];
  heatmapData: HeatmapVenue[];
  venues: Venue[];
  currentYear: number;
}

// ============================================================
// ForecastDashboard Component
// ============================================================

export function ForecastDashboard({
  entries,
  heatmapData,
  venues,
  currentYear,
}: ForecastDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("forecast");
  const [selectedVenueId, setSelectedVenueId] = React.useState<string>("all");
  const [predictions, setPredictions] = React.useState<ForecastPrediction[]>(
    []
  );
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Generate AI forecast predictions on mount and when venue changes
  const handleGenerateAI = React.useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await getAIDemandForecast({
        venueId: selectedVenueId === "all" ? undefined : selectedVenueId,
        months: 6,
      });
      if (result.success) {
        setPredictions(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to generate AI predictions");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedVenueId]);

  // Auto-generate on initial load
  React.useEffect(() => {
    handleGenerateAI();
  }, [handleGenerateAI]);

  return (
    <div className="space-y-4">
      {/* Venue Filter + AI Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={selectedVenueId}
            onValueChange={setSelectedVenueId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={handleGenerateAI}
          disabled={isGenerating}
          size="sm"
        >
          {isGenerating ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SparklesIcon className="mr-2 size-4" />
          )}
          Refresh AI Predictions
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="forecast">
            <SparklesIcon className="mr-1.5 size-3.5" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="heatmap">
            <FlameIcon className="mr-1.5 size-3.5" />
            Demand Heatmap
          </TabsTrigger>
        </TabsList>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6 mt-4">
          {/* AI Forecast Chart */}
          <ForecastChart predictions={predictions} actuals={entries} />

          {/* Existing Forecast Table */}
          <ForecastTable data={entries} />
        </TabsContent>

        {/* Demand Heatmap Tab */}
        <TabsContent value="heatmap" className="mt-4">
          <DemandHeatmap data={heatmapData} year={currentYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
