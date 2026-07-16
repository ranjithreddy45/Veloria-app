import { Separator } from "veloria-app";

export const Horizontal = () => (
  <div className="w-80">
    <div className="pb-3">
      <p className="text-sm font-medium">Booking summary</p>
      <p className="text-xs text-muted-foreground">
        Grand Orchid Hall · 14 Nov 2026
      </p>
    </div>
    <Separator />
    <div className="flex justify-between py-3 text-sm">
      <span className="text-muted-foreground">Venue rental</span>
      <span>₹2,50,000</span>
    </div>
    <Separator />
    <div className="flex justify-between py-3 text-sm">
      <span className="text-muted-foreground">Catering (450 pax)</span>
      <span>₹5,85,000</span>
    </div>
    <Separator />
    <div className="flex justify-between pt-3 text-sm font-semibold">
      <span>Total</span>
      <span>₹8,35,000</span>
    </div>
  </div>
);

export const Vertical = () => (
  <div className="flex items-center gap-3 text-sm" style={{ height: 20 }}>
    <span>Lotus Lawn</span>
    <Separator orientation="vertical" />
    <span>Reception</span>
    <Separator orientation="vertical" />
    <span>650 guests</span>
    <Separator orientation="vertical" />
    <span className="text-muted-foreground">BEO-1042</span>
  </div>
);

export const SectionDivider = () => (
  <div className="flex w-80 flex-col gap-3">
    <p className="text-sm text-muted-foreground">
      Site visit completed on 08 Jul — couple shortlisted Pearl Pavilion.
    </p>
    <div className="flex items-center gap-3">
      <Separator className="flex-1" style={{ width: "auto" }} />
      <span className="text-xs text-muted-foreground">Quotation sent</span>
      <Separator className="flex-1" style={{ width: "auto" }} />
    </div>
    <p className="text-sm text-muted-foreground">
      QTN-2026-0412 shared with vendor packages · ₹8,35,000.
    </p>
  </div>
);
