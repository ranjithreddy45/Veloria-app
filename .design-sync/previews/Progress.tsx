import { Progress } from "veloria-app";

export const Values = () => (
  <div className="flex w-80 flex-col gap-4">
    <Progress value={0} />
    <Progress value={25} />
    <Progress value={60} />
    <Progress value={85} />
    <Progress value={100} />
  </div>
);

export const LabeledPayments = () => (
  <div className="flex w-80 flex-col gap-5">
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span>Advance collected</span>
        <span className="text-muted-foreground">₹3,00,000 / ₹8,35,000</span>
      </div>
      <Progress value={36} />
    </div>
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span>Vendor payouts settled</span>
        <span className="text-muted-foreground">₹1,68,000 / ₹2,40,000</span>
      </div>
      <Progress value={70} />
    </div>
  </div>
);

export const EventReadiness = () => (
  <div className="flex w-80 flex-col gap-2">
    <div className="flex justify-between text-sm">
      <span className="font-medium">Event-day readiness</span>
      <span className="text-muted-foreground">11 of 12 checks</span>
    </div>
    <Progress value={92} />
    <p className="text-xs text-muted-foreground">
      Pending: vendor T&amp;C confirmation for décor — Grand Orchid Hall, 14 Nov
    </p>
  </div>
);
