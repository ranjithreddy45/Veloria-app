import { CountUp } from "veloria-app";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const RevenueKpi = () => (
  <div className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">Confirmed revenue — Nov 2026</p>
    <CountUp value={4650000} format={inr} className="text-3xl font-semibold tracking-tight" />
    <p className="text-xs text-muted-foreground">across 9 bookings</p>
  </div>
);

export const KpiRow = () => (
  <div className="flex items-start gap-8">
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Active leads</p>
      <CountUp value={128} className="text-2xl font-semibold tabular-nums" />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Site visits this week</p>
      <CountUp value={17} className="text-2xl font-semibold tabular-nums" />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Quote win rate</p>
      <CountUp
        value={38.4}
        decimals={1}
        format={(n) => `${n.toFixed(1)}%`}
        className="text-2xl font-semibold tabular-nums"
      />
    </div>
  </div>
);

export const Formats = () => (
  <div className="flex flex-col gap-2 text-sm">
    <div className="flex items-center justify-between" style={{ width: 288 }}>
      <span className="text-muted-foreground">Advance received</span>
      <CountUp value={300000} format={inr} className="font-semibold tabular-nums" />
    </div>
    <div className="flex items-center justify-between" style={{ width: 288 }}>
      <span className="text-muted-foreground">Guests expected</span>
      <CountUp value={650} className="font-semibold tabular-nums" />
    </div>
    <div className="flex items-center justify-between" style={{ width: 288 }}>
      <span className="text-muted-foreground">Avg. booking value (lakh)</span>
      <CountUp
        value={8.35}
        decimals={2}
        format={(n) => `₹${n.toFixed(2)} L`}
        className="font-semibold tabular-nums"
      />
    </div>
  </div>
);
