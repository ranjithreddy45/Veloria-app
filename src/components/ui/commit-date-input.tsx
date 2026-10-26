"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { isCommittableDate } from "@/lib/ui/date-input";

// ============================================================
// A date box for FILTERS: it keeps what is being typed to itself and only
// hands a value on (onCommit) once it is a real date or the box was cleared.
// A plain controlled <Input type="date"> wired to the URL lost every typed
// date after the first year digit — see lib/ui/date-input.ts.
// ============================================================

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "defaultValue"> & {
  value: string;
  onCommit: (value: string) => void;
};

export function CommitDateInput({ value, onCommit, onBlur, ...rest }: Props) {
  const [draft, setDraft] = React.useState(value);
  // The applied value can change from outside (Clear filters, back button).
  React.useEffect(() => setDraft(value), [value]);

  return (
    <Input
      {...rest}
      type="date"
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (isCommittableDate(v) && v !== value) onCommit(v);
      }}
      onBlur={(e) => {
        // Left half-typed: show the applied value again rather than a stale draft.
        if (!isCommittableDate(draft)) setDraft(value);
        onBlur?.(e);
      }}
    />
  );
}
