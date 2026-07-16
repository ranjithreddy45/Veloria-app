import { useState } from "react";
import { SegmentedControl } from "veloria-app";

export const Default = () => {
  const [range, setRange] = useState("month");
  return (
    <SegmentedControl
      ariaLabel="Report range"
      value={range}
      onChange={setRange}
      options={[
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
        { value: "quarter", label: "Quarter" },
        { value: "year", label: "Year" },
      ]}
    />
  );
};

export const ReadinessStatus = () => {
  const [status, setStatus] = useState("pending");
  return (
    <div className="flex w-96 items-center justify-between">
      <p className="text-sm">Mandap decor sign-off</p>
      <SegmentedControl
        ariaLabel="Mandap decor sign-off status"
        size="sm"
        value={status}
        onChange={setStatus}
        options={[
          { value: "done", label: "Done", tone: "done" },
          { value: "pending", label: "Pending", tone: "pending" },
          { value: "na", label: "N/A", tone: "na" },
        ]}
      />
    </div>
  );
};

export const RiskFilter = () => {
  const [filter, setFilter] = useState("overdue");
  return (
    <SegmentedControl
      ariaLabel="Payment reminder filter"
      value={filter}
      onChange={setFilter}
      options={[
        { value: "all", label: "All invoices" },
        { value: "due", label: "Due soon", tone: "pending" },
        { value: "overdue", label: "Overdue", tone: "danger" },
      ]}
    />
  );
};

export const Disabled = () => {
  const [slot, setSlot] = useState("evening");
  return (
    <SegmentedControl
      ariaLabel="Event slot (locked after guest confirmation)"
      disabled
      value={slot}
      onChange={setSlot}
      options={[
        { value: "morning", label: "Morning" },
        { value: "evening", label: "Evening" },
        { value: "fullday", label: "Full day" },
      ]}
    />
  );
};
