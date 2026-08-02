"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
} from "@/actions/commission.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

type RuleItem = {
  id: string;
  name: string;
  role: string | null;
  userId: string | null;
  bookingType: string | null;
  percentage: number;
  flatAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { entries: number };
};

interface CommissionRuleFormProps {
  initialRules: RuleItem[];
}

// ============================================================
// Component
// ============================================================

export function CommissionRuleForm({ initialRules }: CommissionRuleFormProps) {
  const [rules, setRules] = useState<RuleItem[]>(initialRules);
  const [isPending, startTransition] = useTransition();

  // Add rule dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newBookingType, setNewBookingType] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newFlatAmount, setNewFlatAmount] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  // Edit rule dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<RuleItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editBookingType, setEditBookingType] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editFlatAmount, setEditFlatAmount] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // ========================================
  // Create Rule
  // ========================================

  const resetAddForm = () => {
    setNewName("");
    setNewRole("");
    setNewBookingType("");
    setNewPercentage("");
    setNewFlatAmount("");
    setNewIsActive(true);
  };

  const handleCreateRule = () => {
    if (!newName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    const percentage = parseFloat(newPercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast.error("Percentage must be between 0 and 100");
      return;
    }

    const flatAmount = newFlatAmount ? parseFloat(newFlatAmount) : null;
    if (flatAmount !== null && (isNaN(flatAmount) || flatAmount <= 0)) {
      toast.error("Flat amount must be a positive number");
      return;
    }

    startTransition(async () => {
      const result = await createCommissionRule({
        name: newName.trim(),
        role: newRole || undefined,
        bookingType: newBookingType || undefined,
        percentage,
        flatAmount,
        isActive: newIsActive,
      });

      if (result.success) {
        toast.success("Commission rule created");
        setRules((prev) => [
          {
            ...result.data,
            _count: { entries: 0 },
          },
          ...prev,
        ]);
        resetAddForm();
        setAddDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  // ========================================
  // Edit Rule
  // ========================================

  const openEditDialog = (rule: RuleItem) => {
    setEditRule(rule);
    setEditName(rule.name);
    setEditRole(rule.role || "");
    setEditBookingType(rule.bookingType || "");
    setEditPercentage(String(rule.percentage));
    setEditFlatAmount(rule.flatAmount ? String(rule.flatAmount) : "");
    setEditIsActive(rule.isActive);
    setEditDialogOpen(true);
  };

  const handleUpdateRule = () => {
    if (!editRule || !editName.trim()) return;

    const percentage = parseFloat(editPercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast.error("Percentage must be between 0 and 100");
      return;
    }

    const flatAmount = editFlatAmount ? parseFloat(editFlatAmount) : null;
    if (flatAmount !== null && (isNaN(flatAmount) || flatAmount <= 0)) {
      toast.error("Flat amount must be a positive number");
      return;
    }

    startTransition(async () => {
      const result = await updateCommissionRule(editRule.id, {
        name: editName.trim(),
        role: editRole || undefined,
        bookingType: editBookingType || undefined,
        percentage,
        flatAmount,
        isActive: editIsActive,
      });

      if (result.success) {
        toast.success("Commission rule updated");
        setRules((prev) =>
          prev.map((r) =>
            r.id === editRule.id
              ? { ...r, ...result.data, _count: r._count }
              : r
          )
        );
        setEditDialogOpen(false);
        setEditRule(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  // ========================================
  // Delete Rule
  // ========================================

  const handleDeleteRule = (rule: RuleItem) => {
    startTransition(async () => {
      const result = await deleteCommissionRule(rule.id);

      if (result.success) {
        toast.success("Commission rule deleted");
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
      } else {
        toast.error(result.error);
      }
    });
  };

  // ========================================
  // Toggle Active
  // ========================================

  const handleToggleActive = (rule: RuleItem) => {
    startTransition(async () => {
      const result = await updateCommissionRule(rule.id, {
        name: rule.name,
        role: rule.role || undefined,
        bookingType: rule.bookingType || undefined,
        percentage: rule.percentage,
        flatAmount: rule.flatAmount,
        isActive: !rule.isActive,
      });

      if (result.success) {
        toast.success(
          rule.isActive ? "Rule deactivated" : "Rule activated"
        );
        setRules((prev) =>
          prev.map((r) =>
            r.id === rule.id ? { ...r, isActive: !r.isActive } : r
          )
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Rule List */}
      <div className="rounded-xl border border-border bg-card">
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              index !== rules.length - 1
                ? "border-b border-zinc-100"
                : ""
            }`}
          >
            {/* Rule Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 truncate">
                  {rule.name}
                </span>
                {!rule.isActive && (
                  <Badge variant="secondary" className="text-meta">
                    Inactive
                  </Badge>
                )}
                {rule.role && (
                  <Badge
                    variant="outline"
                    className="text-meta bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {rule.role}
                  </Badge>
                )}
                {rule.bookingType && (
                  <Badge
                    variant="outline"
                    className="text-meta bg-purple-50 text-purple-700 border-purple-200"
                  >
                    {rule.bookingType}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {rule.percentage}%
                {rule.flatAmount ? ` + ${formatINR(rule.flatAmount)} flat` : ""}
                {" · "}
                {rule._count.entries}{" "}
                {rule._count.entries === 1 ? "entry" : "entries"}
              </div>
            </div>

            {/* Active Toggle */}
            <Switch
              checked={rule.isActive}
              onCheckedChange={() => handleToggleActive(rule)}
              disabled={isPending}
            />

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => openEditDialog(rule)}
              >
                <Pencil className="size-3.5" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-zinc-400 hover:text-red-600"
                    disabled={rule._count.entries > 0}
                    title={
                      rule._count.entries > 0
                        ? "Cannot delete rule with entries"
                        : "Delete rule"
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &quot;{rule.name}&quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {rule._count.entries > 0
                        ? `This rule has ${rule._count.entries} commission entries. Remove entries before deleting this rule.`
                        : "This action cannot be undone. The rule will be permanently removed."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    {rule._count.entries === 0 && (
                      <AlertDialogAction
                        onClick={() => handleDeleteRule(rule)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-zinc-400">
              No commission rules configured yet.
            </p>
          </div>
        )}
      </div>

      {/* Add Rule Button */}
      <Button
        variant="outline"
        onClick={() => setAddDialogOpen(true)}
        className="gap-2"
      >
        <Plus className="size-4" />
        Add Rule
      </Button>

      {/* Add Rule Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Commission Rule</DialogTitle>
            <DialogDescription>
              Create a new commission calculation rule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-rule-name">Rule Name *</Label>
              <Input
                id="new-rule-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Sales Executive Commission"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-rule-percentage">Percentage *</Label>
                <Input
                  id="new-rule-percentage"
                  type="number"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  placeholder="e.g., 10"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-rule-flat">Flat Amount (optional)</Label>
                <Input
                  id="new-rule-flat"
                  type="number"
                  value={newFlatAmount}
                  onChange={(e) => setNewFlatAmount(e.target.value)}
                  placeholder="e.g., 500"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-rule-role">Role (optional)</Label>
                <Input
                  id="new-rule-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g., SALES_EXEC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-rule-booking-type">
                  Booking Type (optional)
                </Label>
                <Input
                  id="new-rule-booking-type"
                  value={newBookingType}
                  onChange={(e) => setNewBookingType(e.target.value)}
                  placeholder="e.g., Wedding"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="new-rule-active"
                checked={newIsActive}
                onCheckedChange={setNewIsActive}
              />
              <Label htmlFor="new-rule-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddForm();
                setAddDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRule}
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Commission Rule</DialogTitle>
            <DialogDescription>
              Update the commission rule settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-rule-name">Rule Name *</Label>
              <Input
                id="edit-rule-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rule-percentage">Percentage *</Label>
                <Input
                  id="edit-rule-percentage"
                  type="number"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rule-flat">Flat Amount (optional)</Label>
                <Input
                  id="edit-rule-flat"
                  type="number"
                  value={editFlatAmount}
                  onChange={(e) => setEditFlatAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rule-role">Role (optional)</Label>
                <Input
                  id="edit-rule-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="e.g., SALES_EXEC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rule-booking-type">
                  Booking Type (optional)
                </Label>
                <Input
                  id="edit-rule-booking-type"
                  value={editBookingType}
                  onChange={(e) => setEditBookingType(e.target.value)}
                  placeholder="e.g., Wedding"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="edit-rule-active"
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
              <Label htmlFor="edit-rule-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRule}
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
