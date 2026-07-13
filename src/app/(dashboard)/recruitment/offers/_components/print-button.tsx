"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Small client island — the letter page is otherwise a server component.
// window.print() opens the browser print / "Save as PDF" dialog (no PDF lib).
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()} className="gap-1.5">
      <Printer className="size-4" /> Print / Save PDF
    </Button>
  );
}
