import { Skeleton } from "veloria-app";

export const Shapes = () => (
  <div className="flex items-center gap-4">
    <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
    <Skeleton style={{ width: 160, height: 16 }} />
    <Skeleton style={{ width: 96, height: 24 }} />
    <Skeleton className="rounded-lg" style={{ width: 64, height: 40 }} />
  </div>
);

export const BookingCard = () => (
  <div className="flex w-80 flex-col gap-3 rounded-xl border p-4">
    <div className="flex items-center gap-3">
      <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
      <div className="flex flex-col gap-2">
        <Skeleton style={{ width: 140, height: 14 }} />
        <Skeleton style={{ width: 96, height: 12 }} />
      </div>
    </div>
    <Skeleton style={{ width: "100%", height: 12 }} />
    <Skeleton style={{ width: "83%", height: 12 }} />
    <div className="flex items-center justify-between">
      <Skeleton style={{ width: 80, height: 22 }} />
      <Skeleton style={{ width: 100, height: 32 }} />
    </div>
  </div>
);

export const LeadListRows = () => (
  <div className="flex w-80 flex-col gap-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton style={{ width: "60%", height: 12 }} />
          <Skeleton style={{ width: "40%", height: 10 }} />
        </div>
        <Skeleton style={{ width: 56, height: 20 }} />
      </div>
    ))}
  </div>
);
