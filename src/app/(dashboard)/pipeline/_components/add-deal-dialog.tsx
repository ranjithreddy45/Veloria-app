"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createDeal,
  getAvailableLeads,
  getTeamMembers,
} from "@/actions/pipeline.actions";

// ============================================================
// Types
// ============================================================

type AvailableLead = {
  id: string;
  title: string;
  estimatedValue: unknown;
  eventType: string | null;
  source: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
};

type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
};

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageName: string;
  onDealCreated: () => void;
}

// ============================================================
// Component
// ============================================================

export function AddDealDialog({
  open,
  onOpenChange,
  stageId,
  stageName,
  onDealCreated,
}: AddDealDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("50");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [notes, setNotes] = useState("");

  // Lead search
  const [leads, setLeads] = useState<AvailableLead[]>([]);
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Load team members on dialog open
  useEffect(() => {
    if (open) {
      getTeamMembers().then((result) => {
        if (result.success) {
          setTeamMembers(result.data);
        }
      });
      // Initial lead load
      searchLeads("");
    }
  }, [open]);

  const searchLeads = useCallback(async (search: string) => {
    setLeadsLoading(true);
    const result = await getAvailableLeads(search);
    if (result.success) {
      setLeads(result.data);
    }
    setLeadsLoading(false);
  }, []);

  // Debounced lead search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leadSearchOpen) {
        searchLeads(leadSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch, leadSearchOpen, searchLeads]);

  // Auto-populate from selected lead
  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  useEffect(() => {
    if (selectedLead) {
      if (!title) {
        setTitle(selectedLead.title);
      }
      if (!value && selectedLead.estimatedValue) {
        setValue(String(Number(selectedLead.estimatedValue)));
      }
    }
  }, [selectedLeadId, selectedLead, title, value]);

  const resetForm = () => {
    setTitle("");
    setSelectedLeadId("");
    setValue("");
    setProbability("50");
    setExpectedCloseDate("");
    setAssignedToId("");
    setNotes("");
    setLeadSearch("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLeadId) {
      toast.error("Please select a lead");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a deal title");
      return;
    }

    if (!value || parseFloat(value) <= 0) {
      toast.error("Please enter a valid deal value");
      return;
    }

    startTransition(async () => {
      const result = await createDeal({
        title: title.trim(),
        leadId: selectedLeadId,
        stageId,
        value: parseFloat(value),
        probability: parseInt(probability) || 50,
        expectedCloseDate: expectedCloseDate
          ? new Date(expectedCloseDate)
          : null,
        assignedToId: assignedToId || null,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast.success("Deal created successfully", {
          description: `"${title}" has been added to ${stageName}`,
        });
        resetForm();
        onOpenChange(false);
        onDealCreated();
      } else {
        toast.error("Failed to create deal", { description: result.error });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Deal to {stageName}</DialogTitle>
          <DialogDescription>
            Create a new deal from an existing lead. The lead will be linked to
            this deal in the pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead Selection (Searchable) */}
          <div className="space-y-2">
            <Label htmlFor="lead" className="text-sm font-medium">
              Lead <span className="text-red-500">*</span>
            </Label>
            <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadSearchOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedLead ? (
                    <span className="truncate">
                      {selectedLead.title} -{" "}
                      {selectedLead.contact.firstName}{" "}
                      {selectedLead.contact.lastName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Search for a lead...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search leads by name, contact, or email..."
                    value={leadSearch}
                    onValueChange={setLeadSearch}
                  />
                  <CommandList>
                    {leadsLoading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-4 animate-spin text-zinc-400" />
                      </div>
                    )}
                    {!leadsLoading && leads.length === 0 && (
                      <CommandEmpty>
                        No available leads found. All leads may already have
                        deals.
                      </CommandEmpty>
                    )}
                    <CommandGroup>
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.id}
                          onSelect={(val) => {
                            setSelectedLeadId(
                              val === selectedLeadId ? "" : val
                            );
                            setLeadSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              selectedLeadId === lead.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">
                              {lead.title}
                            </span>
                            <span className="text-xs text-zinc-500 truncate">
                              {lead.contact.firstName} {lead.contact.lastName}
                              {lead.contact.company
                                ? ` - ${lead.contact.company}`
                                : ""}
                              {lead.eventType ? ` | ${lead.eventType}` : ""}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Deal Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Deal Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wedding Reception - Kumar Family"
            />
          </div>

          {/* Value + Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value" className="text-sm font-medium">
                Value (INR) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="value"
                type="number"
                min="0"
                step="1000"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probability" className="text-sm font-medium">
                Probability (%)
              </Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <Label htmlFor="close-date" className="text-sm font-medium">
              Expected Close Date
            </Label>
            <Input
              id="close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assigned-to" className="text-sm font-medium">
              Assigned To
            </Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name ?? member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details about this deal..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Deal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
