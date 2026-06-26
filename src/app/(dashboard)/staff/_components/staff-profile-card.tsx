"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserIcon,
  BriefcaseIcon,
  PhoneIcon,
  BanknoteIcon,
  PencilIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import { updateStaffProfile } from "@/actions/staff.actions";

// ============================================================
// Types
// ============================================================

type JsonObj = Record<string, unknown> | null;

interface StaffProfileData {
  id: string;
  department: string | null;
  designation: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  bankDetails: JsonObj | unknown;
  emergencyContact: JsonObj | unknown;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  _count?: {
    shifts: number;
    payroll: number;
  };
}

function asBankDetails(v: unknown): { bankName?: string; accountNumber?: string; ifscCode?: string } | null {
  if (!v || typeof v !== "object") return null;
  return v as { bankName?: string; accountNumber?: string; ifscCode?: string };
}

function asEmergencyContact(v: unknown): { name?: string; phone?: string; relation?: string } | null {
  if (!v || typeof v !== "object") return null;
  return v as { name?: string; phone?: string; relation?: string };
}

interface StaffProfileCardProps {
  profile: StaffProfileData;
}

// ============================================================
// Edit Profile Dialog
// ============================================================

function EditProfileDialog({ profile }: { profile: StaffProfileData }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const data = {
      department: formData.get("department") as string,
      designation: formData.get("designation") as string,
      hourlyRate: formData.get("hourlyRate")
        ? Number(formData.get("hourlyRate"))
        : 0,
      monthlyRate: formData.get("monthlyRate")
        ? Number(formData.get("monthlyRate"))
        : 0,
      bankDetails: {
        bankName: formData.get("bankName") as string,
        accountNumber: formData.get("accountNumber") as string,
        ifscCode: formData.get("ifscCode") as string,
      },
      emergencyContact: {
        name: formData.get("ecName") as string,
        phone: formData.get("ecPhone") as string,
        relation: formData.get("ecRelation") as string,
      },
    };

    // Sensitive financial fields (pay rates, bank details) feed payroll
    // calculations directly. Require an explicit confirmation before applying
    // changes to them so a manager cannot silently/accidentally alter payroll.
    const prevBank = asBankDetails(profile.bankDetails);
    const sensitiveChanges: string[] = [];
    if (data.hourlyRate !== (profile.hourlyRate ?? 0)) {
      sensitiveChanges.push(
        `Hourly rate: ${formatINR(profile.hourlyRate ?? 0)} → ${formatINR(data.hourlyRate)}`,
      );
    }
    if (data.monthlyRate !== (profile.monthlyRate ?? 0)) {
      sensitiveChanges.push(
        `Monthly rate: ${formatINR(profile.monthlyRate ?? 0)} → ${formatINR(data.monthlyRate)}`,
      );
    }
    if (
      data.bankDetails.bankName !== (prevBank?.bankName ?? "") ||
      data.bankDetails.accountNumber !== (prevBank?.accountNumber ?? "") ||
      data.bankDetails.ifscCode !== (prevBank?.ifscCode ?? "")
    ) {
      sensitiveChanges.push("Bank details");
    }

    if (sensitiveChanges.length > 0) {
      const confirmed = window.confirm(
        "You are changing payroll-sensitive fields for " +
          (profile.user.name || "this staff member") +
          ":\n\n" +
          sensitiveChanges.map((c) => `• ${c}`).join("\n") +
          "\n\nThese affect payroll calculations. Continue?",
      );
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      const result = await updateStaffProfile(profile.id, data);

      if (result.success) {
        toast.success("Profile updated successfully");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("[UPDATE_STAFF_PROFILE_ERROR]", err);
      toast.error("Something went wrong while updating the profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs">
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Profile - {profile.user.name || "Staff Member"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                name="department"
                defaultValue={profile.department || ""}
                placeholder="e.g. Events, Kitchen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                name="designation"
                defaultValue={profile.designation || ""}
                placeholder="e.g. Manager, Chef"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input
                type="number"
                name="hourlyRate"
                step="0.01"
                min="0"
                defaultValue={profile.hourlyRate || ""}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyRate">Monthly Rate</Label>
              <Input
                type="number"
                name="monthlyRate"
                step="0.01"
                min="0"
                defaultValue={profile.monthlyRate || ""}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">Bank Details</h4>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  name="bankName"
                  defaultValue={asBankDetails(profile.bankDetails)?.bankName || ""}
                  placeholder="e.g. State Bank of India"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    name="accountNumber"
                    defaultValue={asBankDetails(profile.bankDetails)?.accountNumber || ""}
                    placeholder="Account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input
                    name="ifscCode"
                    defaultValue={asBankDetails(profile.bankDetails)?.ifscCode || ""}
                    placeholder="e.g. SBIN0001234"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">Emergency Contact</h4>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ecName">Name</Label>
                  <Input
                    name="ecName"
                    defaultValue={asEmergencyContact(profile.emergencyContact)?.name || ""}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ecRelation">Relation</Label>
                  <Input
                    name="ecRelation"
                    defaultValue={asEmergencyContact(profile.emergencyContact)?.relation || ""}
                    placeholder="e.g. Spouse, Parent"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecPhone">Phone</Label>
                <Input
                  name="ecPhone"
                  defaultValue={asEmergencyContact(profile.emergencyContact)?.phone || ""}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Staff Profile Card
// ============================================================

export function StaffProfileCard({ profile }: StaffProfileCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {profile.user.name || "Unnamed"}
              </CardTitle>
              <CardDescription className="text-xs">
                {profile.user.email}
              </CardDescription>
            </div>
          </div>
          <EditProfileDialog profile={profile} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Department & Designation */}
        {(profile.department || profile.designation) && (
          <div className="flex items-center gap-2 text-sm">
            <BriefcaseIcon className="size-4 text-muted-foreground" />
            <span>
              {[profile.designation, profile.department]
                .filter(Boolean)
                .join(" - ")}
            </span>
          </div>
        )}

        {/* Rates */}
        <div className="flex flex-wrap gap-2">
          {profile.hourlyRate != null && profile.hourlyRate > 0 && (
            <Badge variant="secondary" className="text-xs">
              <BanknoteIcon className="mr-1 size-3" />
              {formatINR(profile.hourlyRate)}/hr
            </Badge>
          )}
          {profile.monthlyRate != null && profile.monthlyRate > 0 && (
            <Badge variant="secondary" className="text-xs">
              <BanknoteIcon className="mr-1 size-3" />
              {formatINR(profile.monthlyRate)}/mo
            </Badge>
          )}
        </div>

        {/* Emergency Contact */}
        {asEmergencyContact(profile.emergencyContact)?.name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PhoneIcon className="size-3" />
            <span>
              Emergency: {asEmergencyContact(profile.emergencyContact)?.name}
              {asEmergencyContact(profile.emergencyContact)?.phone && (
                <> ({asEmergencyContact(profile.emergencyContact)?.phone})</>
              )}
            </span>
          </div>
        )}

        {/* Stats */}
        {profile._count && (
          <div className="flex gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span>{profile._count.shifts} shifts</span>
            <span>{profile._count.payroll} payroll entries</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
