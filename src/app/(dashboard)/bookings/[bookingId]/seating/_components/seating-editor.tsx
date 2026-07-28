"use client";

import React, { useState, useTransition, useMemo, useCallback } from "react";
import {
  LayoutGridIcon,
  PlusIcon,
  Loader2,
  TrashIcon,
  UsersIcon,
  UserPlusIcon,
  XIcon,
  CircleIcon,
  SquareIcon,
  MinusIcon,
  ArrowRightLeftIcon,
  SettingsIcon,
  GripVerticalIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TABLE_SHAPE_LABELS } from "@/lib/constants";

import {
  createChart,
  updateChart,
  addTable,
  updateTable,
  removeTable,
  assignGuest,
  removeGuest,
  moveGuest,
} from "@/actions/seating.actions";

// ============================================================
// Types
// ============================================================

type SeatingGuest = {
  id: string;
  name: string;
  category: string | null;
  seatNumber: number | null;
  notes: string | null;
};

type SeatingTable = {
  id: string;
  label: string;
  gridRow: number;
  gridCol: number;
  capacity: number;
  shape: string;
  notes: string | null;
  chartId: string;
  guests: SeatingGuest[];
};

type SeatingChart = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  bookingId: string;
  tables: SeatingTable[];
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// Shape styling helpers
// ============================================================

const SHAPE_BORDER_COLORS: Record<string, string> = {
  ROUND: "border-blue-400 dark:border-blue-500",
  RECTANGULAR: "border-amber-400 dark:border-amber-500",
  LONG: "border-emerald-400 dark:border-emerald-500",
};

const SHAPE_BG_COLORS: Record<string, string> = {
  ROUND: "bg-blue-50 dark:bg-blue-950/30",
  RECTANGULAR: "bg-amber-50 dark:bg-amber-950/30",
  LONG: "bg-emerald-50 dark:bg-emerald-950/30",
};

function ShapeIcon({ shape, className }: { shape: string; className?: string }) {
  switch (shape) {
    case "ROUND":
      return <CircleIcon className={className} />;
    case "RECTANGULAR":
      return <SquareIcon className={className} />;
    case "LONG":
      return <MinusIcon className={className} />;
    default:
      return <CircleIcon className={className} />;
  }
}

// ============================================================
// CreateChartButton (exported for the server page)
// ============================================================

export function CreateChartButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("Main Hall");
  const [rows, setRows] = useState("6");
  const [columns, setColumns] = useState("8");

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createChart(bookingId, {
        name,
        rows: parseInt(rows, 10) || 6,
        columns: parseInt(columns, 10) || 8,
      });
      if (result.success) {
        toast.success("Seating chart created successfully");
        setDialogOpen(false);
      } else {
        toast.error("Failed to create seating chart", {
          description: result.error,
        });
      }
    });
  };

  return (
    <>
      <Button
        className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700"
        onClick={() => setDialogOpen(true)}
      >
        <PlusIcon className="mr-2 size-4" />
        Create Seating Chart
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Seating Chart</DialogTitle>
            <DialogDescription>
              Set up the floor plan grid for your event. You can adjust the size
              later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chart Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Hall, Outdoor Area"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={columns}
                  onChange={(e) => setColumns(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Chart"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// SeatingEditor Component
// ============================================================

interface SeatingEditorProps {
  bookingId: string;
  chart: SeatingChart;
}

export function SeatingEditor({ bookingId, chart }: SeatingEditorProps) {
  const [isPending, startTransition] = useTransition();

  // Selected table
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Dialogs
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [editTableOpen, setEditTableOpen] = useState(false);
  const [deleteTableOpen, setDeleteTableOpen] = useState(false);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [moveGuestOpen, setMoveGuestOpen] = useState(false);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // Add table form
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableRow, setNewTableRow] = useState("1");
  const [newTableCol, setNewTableCol] = useState("1");
  const [newTableCapacity, setNewTableCapacity] = useState("8");
  const [newTableShape, setNewTableShape] = useState<string>("ROUND");
  const [newTableNotes, setNewTableNotes] = useState("");

  // Edit table form
  const [editLabel, setEditLabel] = useState("");
  const [editRow, setEditRow] = useState("");
  const [editCol, setEditCol] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editShape, setEditShape] = useState<string>("ROUND");
  const [editNotes, setEditNotes] = useState("");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  // Add guest form
  const [guestName, setGuestName] = useState("");
  const [guestCategory, setGuestCategory] = useState("");
  const [guestSeat, setGuestSeat] = useState("");
  const [guestNotes, setGuestNotes] = useState("");

  // Move guest state
  const [movingGuestId, setMovingGuestId] = useState<string | null>(null);
  const [moveTargetTableId, setMoveTargetTableId] = useState<string>("");

  // Delete table state
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  // Grid settings form
  const [gridRows, setGridRows] = useState(String(chart.rows));
  const [gridCols, setGridCols] = useState(String(chart.columns));
  const [chartName, setChartName] = useState(chart.name);

  // ============================================================
  // Computed data
  // ============================================================

  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return chart.tables.find((t) => t.id === selectedTableId) ?? null;
  }, [chart.tables, selectedTableId]);

  const stats = useMemo(() => {
    const totalTables = chart.tables.length;
    const totalCapacity = chart.tables.reduce((sum, t) => sum + t.capacity, 0);
    const totalGuests = chart.tables.reduce(
      (sum, t) => sum + t.guests.length,
      0
    );
    return { totalTables, totalCapacity, totalGuests };
  }, [chart.tables]);

  // Build a map of grid positions to tables for quick lookup
  const tableMap = useMemo(() => {
    const map = new Map<string, SeatingTable>();
    for (const table of chart.tables) {
      map.set(`${table.gridRow}-${table.gridCol}`, table);
    }
    return map;
  }, [chart.tables]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleAddTable = useCallback(() => {
    startTransition(async () => {
      const result = await addTable(chart.id, {
        label: newTableLabel,
        gridRow: parseInt(newTableRow, 10) || 1,
        gridCol: parseInt(newTableCol, 10) || 1,
        capacity: parseInt(newTableCapacity, 10) || 8,
        shape: newTableShape as "ROUND" | "RECTANGULAR" | "LONG",
        notes: newTableNotes,
      });
      if (result.success) {
        toast.success(`Table "${newTableLabel}" added`);
        setAddTableOpen(false);
        resetAddTableForm();
      } else {
        toast.error("Failed to add table", { description: result.error });
      }
    });
  }, [
    chart.id,
    newTableLabel,
    newTableRow,
    newTableCol,
    newTableCapacity,
    newTableShape,
    newTableNotes,
  ]);

  const handleEditTable = useCallback(() => {
    if (!editingTableId) return;
    startTransition(async () => {
      const result = await updateTable(editingTableId, {
        label: editLabel,
        gridRow: parseInt(editRow, 10),
        gridCol: parseInt(editCol, 10),
        capacity: parseInt(editCapacity, 10),
        shape: editShape as "ROUND" | "RECTANGULAR" | "LONG",
        notes: editNotes,
      });
      if (result.success) {
        toast.success("Table updated");
        setEditTableOpen(false);
      } else {
        toast.error("Failed to update table", { description: result.error });
      }
    });
  }, [editingTableId, editLabel, editRow, editCol, editCapacity, editShape, editNotes]);

  const handleDeleteTable = useCallback(() => {
    if (!deletingTableId) return;
    startTransition(async () => {
      const result = await removeTable(deletingTableId);
      if (result.success) {
        toast.success("Table removed");
        setDeleteTableOpen(false);
        setDeletingTableId(null);
        if (selectedTableId === deletingTableId) {
          setSelectedTableId(null);
        }
      } else {
        toast.error("Failed to remove table", { description: result.error });
      }
    });
  }, [deletingTableId, selectedTableId]);

  const handleAssignGuest = useCallback(() => {
    if (!selectedTableId) return;
    startTransition(async () => {
      const result = await assignGuest(selectedTableId, {
        name: guestName,
        category: guestCategory || undefined,
        seatNumber: guestSeat ? parseInt(guestSeat, 10) : undefined,
        notes: guestNotes || undefined,
      });
      if (result.success) {
        toast.success(`Guest "${guestName}" assigned`);
        setAddGuestOpen(false);
        resetGuestForm();
      } else {
        toast.error("Failed to assign guest", { description: result.error });
      }
    });
  }, [selectedTableId, guestName, guestCategory, guestSeat, guestNotes]);

  const handleRemoveGuest = useCallback((guestId: string, guestNameStr: string) => {
    startTransition(async () => {
      const result = await removeGuest(guestId);
      if (result.success) {
        toast.success(`Guest "${guestNameStr}" removed`);
      } else {
        toast.error("Failed to remove guest", { description: result.error });
      }
    });
  }, []);

  const handleMoveGuest = useCallback(() => {
    if (!movingGuestId || !moveTargetTableId) return;
    startTransition(async () => {
      const result = await moveGuest(movingGuestId, moveTargetTableId);
      if (result.success) {
        toast.success("Guest moved successfully");
        setMoveGuestOpen(false);
        setMovingGuestId(null);
        setMoveTargetTableId("");
      } else {
        toast.error("Failed to move guest", { description: result.error });
      }
    });
  }, [movingGuestId, moveTargetTableId]);

  const handleUpdateGrid = useCallback(() => {
    startTransition(async () => {
      const result = await updateChart(chart.id, {
        name: chartName,
        rows: parseInt(gridRows, 10),
        columns: parseInt(gridCols, 10),
      });
      if (result.success) {
        toast.success("Chart settings updated");
        setGridSettingsOpen(false);
      } else {
        toast.error("Failed to update chart", { description: result.error });
      }
    });
  }, [chart.id, chartName, gridRows, gridCols]);

  const openAddTableAtPosition = useCallback(
    (row: number, col: number) => {
      setNewTableRow(String(row));
      setNewTableCol(String(col));
      setNewTableLabel(`Table ${chart.tables.length + 1}`);
      setNewTableCapacity("8");
      setNewTableShape("ROUND");
      setNewTableNotes("");
      setAddTableOpen(true);
    },
    [chart.tables.length]
  );

  const openEditTable = useCallback((table: SeatingTable) => {
    setEditingTableId(table.id);
    setEditLabel(table.label);
    setEditRow(String(table.gridRow));
    setEditCol(String(table.gridCol));
    setEditCapacity(String(table.capacity));
    setEditShape(table.shape);
    setEditNotes(table.notes ?? "");
    setEditTableOpen(true);
  }, []);

  const openDeleteTable = useCallback((tableId: string) => {
    setDeletingTableId(tableId);
    setDeleteTableOpen(true);
  }, []);

  const openMoveGuest = useCallback((guestId: string) => {
    setMovingGuestId(guestId);
    setMoveTargetTableId("");
    setMoveGuestOpen(true);
  }, []);

  // ============================================================
  // Form reset helpers
  // ============================================================

  function resetAddTableForm() {
    setNewTableLabel("");
    setNewTableRow("1");
    setNewTableCol("1");
    setNewTableCapacity("8");
    setNewTableShape("ROUND");
    setNewTableNotes("");
  }

  function resetGuestForm() {
    setGuestName("");
    setGuestCategory("");
    setGuestSeat("");
    setGuestNotes("");
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Chart Name
                </p>
                <p className="mt-1 text-xl font-bold">{chart.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {chart.rows} rows x {chart.columns} columns
                </p>
              </div>
              <div className="rounded-full bg-indigo-100 p-3 dark:bg-indigo-900/30">
                <LayoutGridIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Tables
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalTables}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                <GripVerticalIcon className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Capacity
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalCapacity}</p>
                <p className="mt-1 text-xs text-muted-foreground">seats</p>
              </div>
              <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
                <SquareIcon className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Assigned Guests
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalGuests}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.totalCapacity > 0
                    ? `${Math.round((stats.totalGuests / stats.totalCapacity) * 100)}% filled`
                    : "no tables yet"}
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                <UsersIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            <CircleIcon className="mr-1 size-3" />
            Round
          </Badge>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <SquareIcon className="mr-1 size-3" />
            Rectangular
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <MinusIcon className="mr-1 size-3" />
            Long
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setGridRows(String(chart.rows));
              setGridCols(String(chart.columns));
              setChartName(chart.name);
              setGridSettingsOpen(true);
            }}
          >
            <SettingsIcon className="mr-2 size-4" />
            Grid Settings
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => openAddTableAtPosition(1, 1)}
          >
            <PlusIcon className="mr-2 size-4" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Main layout: Grid + Guest Panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Floor Plan Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Floor Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${chart.columns}, minmax(100px, 1fr))`,
                  gridTemplateRows: `repeat(${chart.rows}, minmax(80px, 1fr))`,
                }}
              >
                {Array.from({ length: chart.rows }).map((_, rowIdx) =>
                  Array.from({ length: chart.columns }).map((_, colIdx) => {
                    const row = rowIdx + 1;
                    const col = colIdx + 1;
                    const table = tableMap.get(`${row}-${col}`);

                    if (table) {
                      const isSelected = selectedTableId === table.id;
                      return (
                        <button
                          key={`${row}-${col}`}
                          onClick={() =>
                            setSelectedTableId(
                              isSelected ? null : table.id
                            )
                          }
                          className={`relative flex flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition-all hover:shadow-md ${
                            SHAPE_BORDER_COLORS[table.shape] ?? "border-zinc-300"
                          } ${
                            SHAPE_BG_COLORS[table.shape] ?? "bg-zinc-50"
                          } ${
                            isSelected
                              ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg"
                              : ""
                          } ${
                            table.shape === "ROUND" ? "rounded-2xl" : ""
                          }`}
                          style={{
                            gridRow: row,
                            gridColumn: col,
                          }}
                        >
                          <ShapeIcon
                            shape={table.shape}
                            className="size-4 text-muted-foreground"
                          />
                          <span className="mt-0.5 text-xs font-semibold truncate max-w-full">
                            {table.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {table.guests.length}/{table.capacity}
                          </span>
                          {table.guests.length >= table.capacity && (
                            <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive" />
                          )}
                        </button>
                      );
                    }

                    return (
                      <button
                        key={`${row}-${col}`}
                        onClick={() => openAddTableAtPosition(row, col)}
                        className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
                        style={{
                          gridRow: row,
                          gridColumn: col,
                        }}
                        title={`Add table at row ${row}, col ${col}`}
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest Panel (right side) */}
        <div className="space-y-4">
          {selectedTable ? (
            <>
              {/* Table Details Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShapeIcon
                        shape={selectedTable.shape}
                        className="size-4"
                      />
                      {selectedTable.label}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEditTable(selectedTable)}
                        title="Edit table"
                      >
                        <SettingsIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => openDeleteTable(selectedTable.id)}
                        title="Delete table"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setSelectedTableId(null)}
                        title="Close panel"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      {TABLE_SHAPE_LABELS[selectedTable.shape] ?? selectedTable.shape}
                    </Badge>
                    <Badge variant="outline">
                      Capacity: {selectedTable.capacity}
                    </Badge>
                    <Badge variant="outline">
                      Position: R{selectedTable.gridRow} C{selectedTable.gridCol}
                    </Badge>
                  </div>
                  {selectedTable.notes && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTable.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between rounded-lg border bg-muted px-3 py-2">
                    <span className="text-sm font-medium">
                      {selectedTable.guests.length} / {selectedTable.capacity}{" "}
                      seats filled
                    </span>
                    <div
                      className="h-2 w-20 rounded-full bg-muted"
                    >
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{
                          width: `${Math.min(
                            (selectedTable.guests.length / selectedTable.capacity) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guest List Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Guests ({selectedTable.guests.length})
                    </CardTitle>
                    <Button
                      size="sm"
                      className="h-7 bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => {
                        resetGuestForm();
                        setAddGuestOpen(true);
                      }}
                      disabled={
                        selectedTable.guests.length >= selectedTable.capacity
                      }
                    >
                      <UserPlusIcon className="mr-1 size-3.5" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedTable.guests.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <UsersIcon className="size-6 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        No guests assigned yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTable.guests.map((guest) => (
                        <div
                          key={guest.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {guest.name}
                            </p>
                            <div className="flex items-center gap-2">
                              {guest.seatNumber && (
                                <span className="text-[10px] text-muted-foreground">
                                  Seat #{guest.seatNumber}
                                </span>
                              )}
                              {guest.category && (
                                <Badge
                                  variant="outline"
                                  className="h-4 text-[10px] px-1"
                                >
                                  {guest.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openMoveGuest(guest.id)}
                              title="Move to another table"
                            >
                              <ArrowRightLeftIcon className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() =>
                                handleRemoveGuest(guest.id, guest.name)
                              }
                              disabled={isPending}
                              title="Remove guest"
                            >
                              <TrashIcon className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <LayoutGridIcon className="size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  Select a table
                </p>
                <p className="mt-1 text-xs text-muted-foreground text-center">
                  Click on a table in the floor plan to view and manage its
                  guests
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ADD TABLE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={addTableOpen} onOpenChange={setAddTableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
            <DialogDescription>
              Place a table on the floor plan grid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table Label</Label>
              <Input
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                placeholder="e.g. Table 1, VIP Table"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Row Position</Label>
                <Input
                  type="number"
                  min={1}
                  max={chart.rows}
                  value={newTableRow}
                  onChange={(e) => setNewTableRow(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Column Position</Label>
                <Input
                  type="number"
                  min={1}
                  max={chart.columns}
                  value={newTableCol}
                  onChange={(e) => setNewTableCol(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select value={newTableShape} onValueChange={setNewTableShape}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TABLE_SHAPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={newTableNotes}
                onChange={(e) => setNewTableNotes(e.target.value)}
                placeholder="e.g. Near the stage, wheelchair accessible"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTableOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleAddTable}
              disabled={isPending || !newTableLabel.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* EDIT TABLE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={editTableOpen} onOpenChange={setEditTableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
            <DialogDescription>
              Update the table configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table Label</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Row Position</Label>
                <Input
                  type="number"
                  min={1}
                  max={chart.rows}
                  value={editRow}
                  onChange={(e) => setEditRow(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Column Position</Label>
                <Input
                  type="number"
                  min={1}
                  max={chart.columns}
                  value={editCol}
                  onChange={(e) => setEditCol(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select value={editShape} onValueChange={setEditShape}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TABLE_SHAPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTableOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleEditTable}
              disabled={isPending || !editLabel.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DELETE TABLE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={deleteTableOpen} onOpenChange={setDeleteTableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this table? All guests assigned to
              this table will also be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTableOpen(false);
                setDeletingTableId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTable}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* ADD GUEST DIALOG */}
      {/* ============================================================ */}
      <Dialog open={addGuestOpen} onOpenChange={setAddGuestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Guest</DialogTitle>
            <DialogDescription>
              Add a guest to {selectedTable?.label}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Input
                  value={guestCategory}
                  onChange={(e) => setGuestCategory(e.target.value)}
                  placeholder="e.g. VIP, Family"
                />
              </div>
              <div className="space-y-2">
                <Label>Seat Number (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={guestSeat}
                  onChange={(e) => setGuestSeat(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={guestNotes}
                onChange={(e) => setGuestNotes(e.target.value)}
                placeholder="e.g. dietary restrictions"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGuestOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleAssignGuest}
              disabled={isPending || !guestName.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Guest"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MOVE GUEST DIALOG */}
      {/* ============================================================ */}
      <Dialog open={moveGuestOpen} onOpenChange={setMoveGuestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Guest</DialogTitle>
            <DialogDescription>
              Select the destination table for this guest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination Table</Label>
              <Select
                value={moveTargetTableId}
                onValueChange={setMoveTargetTableId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {chart.tables
                    .filter((t) => t.id !== selectedTableId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} ({t.guests.length}/{t.capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveGuestOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleMoveGuest}
              disabled={isPending || !moveTargetTableId}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Moving...
                </>
              ) : (
                "Move Guest"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* GRID SETTINGS DIALOG */}
      {/* ============================================================ */}
      <Dialog open={gridSettingsOpen} onOpenChange={setGridSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chart Settings</DialogTitle>
            <DialogDescription>
              Adjust the grid size and chart name. Existing tables outside the
              new bounds will not be removed but may not display on the grid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chart Name</Label>
              <Input
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={gridRows}
                  onChange={(e) => setGridRows(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={gridCols}
                  onChange={(e) => setGridCols(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGridSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleUpdateGrid}
              disabled={isPending || !chartName.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
