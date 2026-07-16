import { Donut } from "veloria-app";

export const HealthBands = () => (
  <div className="flex items-end gap-8">
    <div className="flex flex-col items-center gap-2">
      <Donut value={18} colorClass="text-rose-500" ariaLabel="Pearl Pavilion readiness 18%" />
      <span className="text-xs text-muted-foreground">Pearl Pavilion</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Donut value={55} colorClass="text-amber-500" ariaLabel="Lotus Lawn readiness 55%" />
      <span className="text-xs text-muted-foreground">Lotus Lawn</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Donut value={88} colorClass="text-emerald-500" ariaLabel="Grand Orchid Hall readiness 88%" />
      <span className="text-xs text-muted-foreground">Grand Orchid Hall</span>
    </div>
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-6">
    <Donut value={72} size={36} thickness={4} colorClass="text-violet-500" hideLabel ariaLabel="Budget used 72%" />
    <Donut value={72} size={48} thickness={5} colorClass="text-primary" />
    <Donut value={72} size={64} thickness={7} colorClass="text-primary" />
    <Donut value={72} size={80} thickness={8} colorClass="text-emerald-500" />
  </div>
);

export const KpiCard = () => (
  <div className="flex w-80 items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
    <Donut value={83} size={64} thickness={7} colorClass="text-emerald-500" label="83%" ariaLabel="Advance collection 83%" />
    <div className="grid gap-1">
      <span className="text-sm font-medium">Advance collection</span>
      <span className="text-xs text-muted-foreground">₹41.6L of ₹50.2L collected this month</span>
      <span className="text-xs text-muted-foreground">Nov weddings · 14 bookings</span>
    </div>
  </div>
);

export const ScoreLabel = () => (
  <div className="flex items-center gap-8">
    <div className="flex flex-col items-center gap-2">
      <Donut value={91} size={72} thickness={7} colorClass="text-primary" label="4.6" ariaLabel="KRA score 4.6 of 5" />
      <span className="text-xs text-muted-foreground">KRA score</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Donut value={100} size={72} thickness={7} colorClass="text-emerald-500" label="Won" ariaLabel="Quote won" />
      <span className="text-xs text-muted-foreground">Quote Q-2081</span>
    </div>
  </div>
);
