"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  PlayIcon,
  Loader2Icon,
  ClipboardListIcon,
  XIcon,
  TrashIcon,
} from "lucide-react";

import {
  createTaskTemplate,
  applyTemplate,
  getBookingsForSelect,
} from "@/actions/task.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Types
// ============================================================

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  items: unknown; // JSON
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateItem {
  title: string;
  priority?: string;
}

interface TemplateListProps {
  templates: TemplateData[];
}

// ============================================================
// Component
// ============================================================

export function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();

  // Create Template Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([
    { title: "", priority: "MEDIUM" },
  ]);
  const [isCreating, setIsCreating] = useState(false);

  // Apply Template Dialog State
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<
    { id: string; eventName: string; bookingNumber: string }[]
  >([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const handleAddItem = () => {
    setTemplateItems([...templateItems, { title: "", priority: "MEDIUM" }]);
  };

  const handleRemoveItem = (index: number) => {
    setTemplateItems(templateItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof TemplateItem,
    value: string
  ) => {
    const updated = [...templateItems];
    updated[index] = { ...updated[index], [field]: value };
    setTemplateItems(updated);
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    const validItems = templateItems.filter((item) => item.title.trim());
    if (validItems.length === 0) {
      toast.error("Add at least one task item");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTaskTemplate({
        name: templateName.trim(),
        description: templateDesc.trim() || undefined,
        items: validItems,
      });

      if (result.success) {
        toast.success("Template created");
        setCreateOpen(false);
        setTemplateName("");
        setTemplateDesc("");
        setTemplateItems([{ title: "", priority: "MEDIUM" }]);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenApply = async (templateId: string) => {
    setApplyTemplateId(templateId);
    setApplyOpen(true);
    setIsLoadingBookings(true);

    try {
      const result = await getBookingsForSelect();
      if (result.success) {
        setBookings(result.data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyTemplateId) return;

    setIsApplying(true);
    try {
      const result = await applyTemplate(
        applyTemplateId,
        selectedBookingId || undefined
      );

      if (result.success) {
        toast.success("Template applied! Tasks have been created.");
        setApplyOpen(false);
        setApplyTemplateId(null);
        setSelectedBookingId("");
        router.push("/tasks");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to apply template");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create Task Template</DialogTitle>
              <DialogDescription>
                Define a reusable set of tasks for common workflows.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name *</label>
                <Input
                  placeholder="e.g., Wedding Setup Checklist"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe this template..."
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Task Items</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templateItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={`Task ${index + 1} title`}
                        value={item.title}
                        onChange={(e) =>
                          handleItemChange(index, "title", e.target.value)
                        }
                        className="flex-1 h-8 text-sm"
                      />
                      <Select
                        value={item.priority || "MEDIUM"}
                        onValueChange={(val) =>
                          handleItemChange(index, "priority", val)
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      {templateItems.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-500"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="w-full"
                >
                  <PlusIcon className="mr-2 size-3.5" />
                  Add Task Item
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={isCreating}
              >
                {isCreating && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardListIcon className="size-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-sm mb-2">No templates yet</p>
            <p className="text-zinc-400 text-xs text-center max-w-sm">
              Create a template to quickly generate a set of tasks for common
              workflows like event setup, vendor coordination, etc.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const items = (template.items as TemplateItem[]) || [];

            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {items.length} tasks
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Preview items */}
                  <div className="space-y-1 mb-4">
                    {items.slice(0, 4).map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-zinc-600"
                      >
                        <div className="size-1.5 rounded-full bg-zinc-300 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}
                    {items.length > 4 && (
                      <p className="text-[11px] text-zinc-400 pl-3.5">
                        +{items.length - 4} more tasks
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleOpenApply(template.id)}
                  >
                    <PlayIcon className="mr-2 size-3.5" />
                    Apply Template
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply Template Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
            <DialogDescription>
              This will create tasks from the template. Optionally link them to
              a booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Link to Booking (optional)
              </label>
              {isLoadingBookings ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Loading bookings...
                </div>
              ) : (
                <Select
                  value={selectedBookingId}
                  onValueChange={setSelectedBookingId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No booking (standalone tasks)" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.eventName} ({booking.bookingNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyTemplate} disabled={isApplying}>
              {isApplying && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Create Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
