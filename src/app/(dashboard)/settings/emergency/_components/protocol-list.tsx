"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  ShieldAlertIcon,
  FilterIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  updateProtocol,
  deleteProtocol,
} from "@/actions/emergency.actions";
import {
  EMERGENCY_TYPE_LABELS,
} from "@/lib/constants";
import { ProtocolFormDialog } from "./protocol-form-dialog";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contactNumbers: any;
  lastReviewedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { incidents: number };
}

interface VenueOption {
  id: string;
  name: string;
}

interface ProtocolListProps {
  protocols: ProtocolData[];
  venues: VenueOption[];
}

// ============================================================
// Emergency Type Colors
// ============================================================

const EMERGENCY_TYPE_COLORS: Record<string, string> = {
  FIRE: "bg-red-100 text-red-700 border-red-200",
  MEDICAL: "bg-blue-100 text-blue-700 border-blue-200",
  WEATHER: "bg-cyan-100 text-cyan-700 border-cyan-200",
  SECURITY: "bg-amber-100 text-amber-700 border-amber-200",
  POWER_OUTAGE: "bg-purple-100 text-purple-700 border-purple-200",
  OTHER: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

// ============================================================
// ProtocolList Component
// ============================================================

export function ProtocolList({ protocols, venues }: ProtocolListProps) {
  const router = useRouter();
  const [filterVenue, setFilterVenue] = React.useState<string>("all");
  const [filterType, setFilterType] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProtocol, setEditingProtocol] = React.useState<ProtocolData | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Filtered protocols
  const filtered = React.useMemo(() => {
    return protocols.filter((p) => {
      if (filterVenue !== "all" && p.venueId !== filterVenue) return false;
      if (filterType !== "all" && p.type !== filterType) return false;
      return true;
    });
  }, [protocols, filterVenue, filterType]);

  function openCreateDialog() {
    setEditingProtocol(null);
    setDialogOpen(true);
  }

  function openEditDialog(protocol: ProtocolData) {
    setEditingProtocol(protocol);
    setDialogOpen(true);
  }

  async function handleToggleActive(protocol: ProtocolData) {
    try {
      const result = await updateProtocol(protocol.id, {
        isActive: !protocol.isActive,
      });
      if (result.success) {
        toast.success(
          protocol.isActive ? "Protocol deactivated" : "Protocol activated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update protocol");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const result = await deleteProtocol(deleteId);
      if (result.success) {
        toast.success("Protocol deleted successfully");
        setDeleteId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete protocol");
    }
  }

  function getVenueName(venueId: string | null) {
    if (!venueId) return "All Venues";
    const venue = venues.find((v) => v.id === venueId);
    return venue?.name ?? "Unknown Venue";
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Emergency Protocols
          </h2>
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-muted-foreground" />
            <Select value={filterVenue} onValueChange={setFilterVenue}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(EMERGENCY_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog}>
              <PlusIcon className="mr-2 size-4" />
              Add Protocol
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldAlertIcon className="mx-auto size-10 text-zinc-300 dark:text-zinc-600" />
              <p className="text-muted-foreground mt-3 text-sm">
                No emergency protocols found. Add your first protocol to prepare for emergencies.
              </p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <PlusIcon className="mr-2 size-4" />
                Add First Protocol
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((protocol) => (
              <Card
                key={protocol.id}
                className={!protocol.isActive ? "opacity-60" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {protocol.name}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {getVenueName(protocol.venueId)}
                      </p>
                    </div>
                    <StatusBadge
                      status={protocol.type}
                      colorMap={EMERGENCY_TYPE_COLORS}
                      label={EMERGENCY_TYPE_LABELS[protocol.type] ?? protocol.type}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-xs line-clamp-2">
                    {protocol.procedures}
                  </p>

                  {/* Contact Numbers Preview */}
                  {Array.isArray(protocol.contactNumbers) &&
                    protocol.contactNumbers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <PhoneIcon className="size-3" />
                          Contacts ({protocol.contactNumbers.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {protocol.contactNumbers.slice(0, 3).map((c, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {c.name} ({c.role})
                            </Badge>
                          ))}
                          {protocol.contactNumbers.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{protocol.contactNumbers.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                  <div className="text-muted-foreground text-xs">
                    {protocol._count.incidents} incident
                    {protocol._count.incidents !== 1 ? "s" : ""}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={protocol.isActive}
                        onCheckedChange={() => handleToggleActive(protocol)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {protocol.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(protocol)}
                      >
                        <PencilIcon className="mr-1 size-3" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(protocol.id)}
                      >
                        <TrashIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Protocol Form Dialog */}
      <ProtocolFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        protocol={editingProtocol}
        venues={venues}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Protocol</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this emergency protocol? This action
              cannot be undone. Protocols with linked incidents cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
