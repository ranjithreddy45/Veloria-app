"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ClipboardListIcon,
  FileTextIcon,
  PlusCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { createExecutionPlan } from "@/actions/execution-plan.actions";
import { applySOPToBooking } from "@/actions/sop-template.actions";

interface CreatePlanDialogProps {
  bookingId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates: any[];
}

export function CreatePlanDialog({
  bookingId,
  templates,
}: CreatePlanDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  function handleCreateEmpty() {
    if (!eventDate) {
      toast.error("Please select an event date.");
      return;
    }
    startTransition(async () => {
      const result = await createExecutionPlan({
        bookingId,
        eventDate: new Date(eventDate),
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Execution plan created successfully.");
        setEmptyDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to create execution plan.");
      }
    });
  }

  function handleApplyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Please select a template.");
      return;
    }
    startTransition(async () => {
      const result = await applySOPToBooking(selectedTemplateId, bookingId);
      if (result.success) {
        toast.success("SOP template applied successfully.");
        setTemplateDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to apply SOP template.");
      }
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircleIcon className="size-5 text-blue-600" />
            Create Empty Plan
          </CardTitle>
          <CardDescription>
            Start from scratch and manually add phases and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <ClipboardListIcon className="mr-2 size-4" />
                Create Empty Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Execution Plan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Event Date <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Time</label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Time</label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    placeholder="Optional notes about the execution plan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEmptyDialogOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateEmpty} disabled={isPending}>
                  {isPending && (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  )}
                  Create Plan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-violet-600" />
            Create from SOP Template
          </CardTitle>
          <CardDescription>
            Use a pre-defined SOP template to quickly set up phases and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No SOP templates available. Create one in Settings first.
            </p>
          ) : (
            <Dialog
              open={templateDialogOpen}
              onOpenChange={setTemplateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <FileTextIcon className="mr-2 size-4" />
                  Apply SOP Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply SOP Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Select Template <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.eventType ? ` (${t.eventType})` : ""}
                            {t._count?.phases
                              ? ` - ${t._count.phases} phases`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplateId && (
                    <div className="rounded-md border border-border p-3 text-sm">
                      {(() => {
                        const selected = templates.find(
                          (t) => t.id === selectedTemplateId
                        );
                        if (!selected) return null;
                        return (
                          <div className="space-y-1">
                            <p className="font-medium">{selected.name}</p>
                            {selected.description && (
                              <p className="text-muted-foreground">
                                {selected.description}
                              </p>
                            )}
                            <Separator className="my-2" />
                            <p className="text-muted-foreground">
                              {selected.phases?.length ?? 0} phases with{" "}
                              {selected.phases?.reduce(
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (sum: number, p: any) =>
                                  sum + (p.taskDefinitions?.length ?? 0),
                                0
                              ) ?? 0}{" "}
                              task definitions
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setTemplateDialogOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleApplyTemplate} disabled={isPending}>
                    {isPending && (
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                    )}
                    Apply Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
