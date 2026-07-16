import { Badge } from "veloria-app";
import { CheckCircle2, Clock, IndianRupee, Sparkles } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge>Confirmed</Badge>
    <Badge variant="secondary">Tentative</Badge>
    <Badge variant="success">Advance Paid</Badge>
    <Badge variant="warning">Awaiting Guest OK</Badge>
    <Badge variant="destructive">Overdue</Badge>
    <Badge variant="outline">Grand Orchid Hall</Badge>
    <Badge variant="ghost">Walk-in</Badge>
    <Badge variant="link">QTN-2026-0412</Badge>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge variant="success">
      <CheckCircle2 /> Booking confirmed
    </Badge>
    <Badge variant="warning">
      <Clock /> 48h TAT
    </Badge>
    <Badge>
      <IndianRupee /> ₹4,50,000
    </Badge>
    <Badge variant="outline">
      <Sparkles /> Muhurtham date
    </Badge>
  </div>
);

export const InContext = () => (
  <div className="flex w-80 flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Meera &amp; Arjun — Wedding</p>
        <p className="text-xs text-muted-foreground">Lotus Lawn · 14 Nov 2026</p>
      </div>
      <Badge variant="success">Confirmed</Badge>
    </div>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Kaveri Corp — Annual Gala</p>
        <p className="text-xs text-muted-foreground">Pearl Pavilion · 02 Dec 2026</p>
      </div>
      <Badge variant="warning">Advance due</Badge>
    </div>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Ritika — Sangeet</p>
        <p className="text-xs text-muted-foreground">Grand Orchid Hall · 21 Nov 2026</p>
      </div>
      <Badge variant="destructive">Payment overdue</Badge>
    </div>
  </div>
);
