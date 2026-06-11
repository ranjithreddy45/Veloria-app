"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

import { addGuest, updateGuest } from "@/actions/guest.actions";
import type { GuestInput } from "@/schemas/guest.schema";

// ============================================================
// Types
// ============================================================

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string;
  tableAssignment: string | null;
  rsvpStatus: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  plusOnes: number;
  dietaryRestrictions: string | null;
  notes: string | null;
  guestListId: string;
};

interface AddGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestListId: string;
  editGuest: Guest | null;
}

// ============================================================
// AddGuestDialog Component
// ============================================================

export function AddGuestDialog({
  open,
  onOpenChange,
  guestListId,
  editGuest,
}: AddGuestDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = editGuest !== null;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>("OTHER");
  const [tableAssignment, setTableAssignment] = useState("");
  const [plusOnes, setPlusOnes] = useState("0");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [notes, setNotes] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (open && editGuest) {
      setName(editGuest.name);
      setEmail(editGuest.email ?? "");
      setPhone(editGuest.phone ?? "");
      setCategory(editGuest.category);
      setTableAssignment(editGuest.tableAssignment ?? "");
      setPlusOnes(String(editGuest.plusOnes));
      setDietaryRestrictions(editGuest.dietaryRestrictions ?? "");
      setNotes(editGuest.notes ?? "");
    } else if (open && !editGuest) {
      resetForm();
    }
  }, [open, editGuest]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCategory("OTHER");
    setTableAssignment("");
    setPlusOnes("0");
    setDietaryRestrictions("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Guest name is required");
      return;
    }

    const guestData: GuestInput = {
      name: name.trim(),
      email: email.trim() || "",
      phone: phone.trim() || "",
      category: category as "VIP" | "FAMILY" | "FRIEND" | "CORPORATE" | "OTHER",
      tableAssignment: tableAssignment.trim() || "",
      plusOnes: parseInt(plusOnes, 10) || 0,
      dietaryRestrictions: dietaryRestrictions.trim() || "",
      notes: notes.trim() || "",
    };

    startTransition(async () => {
      if (isEditing && editGuest) {
        const result = await updateGuest(editGuest.id, guestData);
        if (result.success) {
          toast.success("Guest updated", {
            description: `${guestData.name} has been updated.`,
          });
          onOpenChange(false);
          resetForm();
        } else {
          toast.error("Failed to update guest", {
            description: result.error,
          });
        }
      } else {
        const result = await addGuest(guestListId, guestData);
        if (result.success) {
          toast.success("Guest added", {
            description: `${guestData.name} has been added to the guest list.`,
          });
          onOpenChange(false);
          resetForm();
        } else {
          toast.error("Failed to add guest", {
            description: result.error,
          });
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Guest" : "Add Guest"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the guest information below."
              : "Fill in the details to add a new guest to the list."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="guest-name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest-email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-phone" className="text-sm font-medium">
                Phone
              </Label>
              <Input
                id="guest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>
          </div>

          {/* Category + Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest-category" className="text-sm font-medium">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="FAMILY">Family</SelectItem>
                  <SelectItem value="FRIEND">Friend</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-table" className="text-sm font-medium">
                Table Assignment
              </Label>
              <Input
                id="guest-table"
                value={tableAssignment}
                onChange={(e) => setTableAssignment(e.target.value)}
                placeholder="e.g., Table 5"
              />
            </div>
          </div>

          {/* Plus Ones */}
          <div className="space-y-2">
            <Label htmlFor="guest-plus-ones" className="text-sm font-medium">
              Plus Ones
            </Label>
            <Input
              id="guest-plus-ones"
              type="number"
              min="0"
              max="20"
              value={plusOnes}
              onChange={(e) => setPlusOnes(e.target.value)}
            />
          </div>

          {/* Dietary Restrictions */}
          <div className="space-y-2">
            <Label
              htmlFor="guest-dietary"
              className="text-sm font-medium"
            >
              Dietary Restrictions
            </Label>
            <Input
              id="guest-dietary"
              value={dietaryRestrictions}
              onChange={(e) => setDietaryRestrictions(e.target.value)}
              placeholder="e.g., Vegetarian, Gluten-free"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="guest-notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="guest-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about this guest..."
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
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditing ? "Updating..." : "Adding..."}
                </>
              ) : isEditing ? (
                "Update Guest"
              ) : (
                "Add Guest"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
