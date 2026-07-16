import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "veloria-app";
import { ChevronsUpDown } from "lucide-react";

export const QuoteBreakdown = () => (
  <Collapsible defaultOpen className="w-80 rounded-lg border">
    <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
      Quotation Q-2418 — Rs 6,40,000
      <ChevronsUpDown className="size-4 text-muted-foreground" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Grand Orchid Hall (full day)</span>
          <span>Rs 3,50,000</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Catering — 600 plates</span>
          <span>Rs 2,40,000</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Decor package (Silver)</span>
          <span>Rs 50,000</span>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

export const SiteVisitNotes = () => (
  <Collapsible defaultOpen className="w-80">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium">Site visit — Sharma wedding</p>
      <CollapsibleTrigger className="rounded-md border px-2 py-1 text-xs font-medium">
        Toggle notes
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent>
      <div className="mt-2 flex flex-col gap-2">
        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Family preferred Lotus Lawn for the sangeet; asked about valet
          capacity for 250 cars.
        </div>
        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Follow-up: share Pearl Pavilion reception quote by Friday.
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);
