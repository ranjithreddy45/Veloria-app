"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProtocol, updateProtocol } from "@/actions/emergency.actions";
import { EMERGENCY_TYPE_LABELS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface ContactNumber {
  name: string;
  phone: string;
  role: string;
}

interface ProtocolData {
  id: string;
  venueId: string | null;
  name: string;
  type: string;
  procedures: string;
  contactNumbers: ContactNumber[] | null;
  isActive: boolean;
}

interface VenueOption {
  id: string;
  name: string;
}

interface ProtocolFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocol: ProtocolData | null;
  venues: VenueOption[];
}

// ============================================================
// ProtocolFormDialog Component
// ============================================================

export function ProtocolFormDialog({
  open,
  onOpenChange,
  protocol,
  venues,
}: ProtocolFormDialogProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [venueId, setVenueId] = React.useState("");
  const [procedures, setProcedures] = React.useState("");
  const [contactNumbers, setContactNumbers] = React.useState<ContactNumber[]>([]);
  const [isActive, setIsActive] = React.useState(true);

  // Reset form when dialog opens/protocol changes
  React.useEffect(() => {
    if (open) {
      if (protocol) {
        setName(protocol.name);
        setType(protocol.type);
        setVenueId(protocol.venueId || "");
        setProcedures(protocol.procedures);
        setContactNumbers(
          Array.isArray(protocol.contactNumbers) ? protocol.contactNumbers : []
        );
        setIsActive(protocol.isActive);
      } else {
        setName("");
        setType("");
        setVenueId("");
        setProcedures("");
        setContactNumbers([]);
        setIsActive(true);
      }
    }
  }, [open, protocol]);

  function addContactRow() {
    setContactNumbers((prev) => [...prev, { name: "", phone: "", role: "" }]);
  }

  function removeContactRow(index: number) {
    setContactNumbers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateContactRow(
    index: number,
    field: keyof ContactNumber,
    value: string
  ) {
    setContactNumbers((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Protocol name is required");
      return;
    }
    if (!type) {
      toast.error("Emergency type is required");
      return;
    }
    if (!procedures.trim()) {
      toast.error("Procedures are required");
      return;
    }

    // Filter out empty contact rows
    const validContacts = contactNumbers.filter(
      (c) => c.name.trim() && c.phone.trim() && c.role.trim()
    );

    setIsPending(true);
    try {
      const formData = {
        name: name.trim(),
        type: type as "FIRE" | "MEDICAL" | "WEATHER" | "SECURITY" | "POWER_OUTAGE" | "OTHER",
        venueId: venueId || undefined,
        procedures: procedures.trim(),
        contactNumbers: validContacts,
        isActive,
      };

      if (protocol) {
        const result = await updateProtocol(protocol.id, formData);
        if (result.success) {
          toast.success("Protocol updated successfully");
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createProtocol(formData);
        if (result.success) {
          toast.success("Protocol created successfully");
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {protocol ? "Edit Protocol" : "Add Emergency Protocol"}
          </DialogTitle>
          <DialogDescription>
            {protocol
              ? "Update the emergency protocol details below."
              : "Define a new emergency response protocol for your venue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="protocol-name">Protocol Name *</Label>
            <Input
              id="protocol-name"
              placeholder="e.g., Fire Evacuation Plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Type & Venue */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Emergency Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMERGENCY_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Venue (optional)</Label>
              <Select value={venueId || "none"} onValueChange={(val) => setVenueId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All venues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Venues</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Procedures */}
          <div className="space-y-2">
            <Label htmlFor="protocol-procedures">Procedures *</Label>
            <Textarea
              id="protocol-procedures"
              placeholder="Describe the step-by-step emergency response procedures..."
              value={procedures}
              onChange={(e) => setProcedures(e.target.value)}
              rows={5}
            />
          </div>

          {/* Contact Numbers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Emergency Contacts</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContactRow}
              >
                <PlusIcon className="mr-1 size-3" />
                Add Contact
              </Button>
            </div>
            {contactNumbers.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No emergency contacts added. Click &quot;Add Contact&quot; to add one.
              </p>
            )}
            {contactNumbers.map((contact, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
              >
                <div className="space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Name</Label>
                  )}
                  <Input
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) =>
                      updateContactRow(index, "name", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                  )}
                  <Input
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={(e) =>
                      updateContactRow(index, "phone", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Role</Label>
                  )}
                  <Input
                    placeholder="Role"
                    value={contact.role}
                    onChange={(e) =>
                      updateContactRow(index, "role", e.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => removeContactRow(index)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Protocol is active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            )}
            {protocol ? "Update Protocol" : "Create Protocol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
