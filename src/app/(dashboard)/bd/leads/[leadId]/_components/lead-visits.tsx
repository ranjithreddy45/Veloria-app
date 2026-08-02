"use client";

// ============================================================
// Lead-level note composer.
//
// This used to also schedule and list site visits / meetings. That surface now
// lives in the shared <AcqSchedulePanel> (calls + visits + meetings, each with an
// appendable note thread), mounted right below this card on the lead page —
// keeping both would have shown the lead two identical "Site visits & meetings"
// panels. What remains here is the one thing the schedule panel does NOT cover:
// a note about the owner / property that isn't tied to a specific appointment.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotebookPen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addAcqLeadNote } from "@/actions/acq-visit.actions";

export function LeadVisits({ leadId, canWrite }: { leadId: string; canWrite: boolean }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onAddNote() {
    if (!note.trim()) return;
    setPending(true);
    try {
      const r = await addAcqLeadNote(leadId, note);
      if (r.success) {
        setNote("");
        toast.success("Note added");
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-copy">
          <NotebookPen className="size-4 text-primary" /> Add a note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Log a note about this owner / property…"
          disabled={!canWrite || pending}
          rows={2}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={onAddNote} disabled={!canWrite || pending || !note.trim()}>
            <Plus className="size-4" /> Add note
          </Button>
        </div>
        <p className="text-meta text-muted-foreground">
          Notes appear with date &amp; time on the activity timeline below. For notes against a
          specific call, site visit or meeting, use the schedule panel below.
        </p>
      </CardContent>
    </Card>
  );
}
