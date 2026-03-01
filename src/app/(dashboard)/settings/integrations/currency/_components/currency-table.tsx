"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  createCurrency,
  deleteCurrency,
  updateExchangeRate,
} from "@/actions/currency.actions";
import { formatDate } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyTableProps {
  initialCurrencies: Currency[];
}

// ============================================================
// Currency Table Component
// ============================================================

export function CurrencyTable({ initialCurrencies }: CurrencyTableProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(initialCurrencies);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Add form state
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newRate, setNewRate] = useState("");

  // ----------------------------------------------------------
  // Inline Edit Exchange Rate
  // ----------------------------------------------------------

  function handleStartEdit(currency: Currency) {
    setEditingId(currency.id);
    setEditRate(String(currency.exchangeRate));
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditRate("");
  }

  function handleSaveRate(id: string) {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Exchange rate must be a positive number");
      return;
    }

    startTransition(async () => {
      const result = await updateExchangeRate(id, rate);
      if (result.success) {
        setCurrencies((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, exchangeRate: rate, lastUpdated: new Date().toISOString() }
              : c
          )
        );
        toast.success("Exchange rate updated");
        setEditingId(null);
        setEditRate("");
      } else {
        toast.error(result.error);
      }
    });
  }

  // ----------------------------------------------------------
  // Add Currency
  // ----------------------------------------------------------

  function handleAddCurrency() {
    const rate = parseFloat(newRate);
    if (!newCode || !newName || !newSymbol || isNaN(rate) || rate <= 0) {
      toast.error("Please fill in all fields with valid values");
      return;
    }

    startTransition(async () => {
      const result = await createCurrency({
        code: newCode.toUpperCase(),
        name: newName,
        symbol: newSymbol,
        exchangeRate: rate,
      });

      if (result.success) {
        setCurrencies((prev) => [...prev, result.data as Currency].sort((a, b) =>
          a.code.localeCompare(b.code)
        ));
        toast.success(`Currency ${newCode.toUpperCase()} added`);
        setAddDialogOpen(false);
        resetAddForm();
      } else {
        toast.error(result.error);
      }
    });
  }

  function resetAddForm() {
    setNewCode("");
    setNewName("");
    setNewSymbol("");
    setNewRate("");
  }

  // ----------------------------------------------------------
  // Delete Currency
  // ----------------------------------------------------------

  function handleDelete(id: string, code: string) {
    startTransition(async () => {
      const result = await deleteCurrency(id);
      if (result.success) {
        setCurrencies((prev) => prev.filter((c) => c.id !== id));
        toast.success(`Currency ${code} deleted`);
      } else {
        toast.error(result.error);
      }
    });
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Currencies</CardTitle>
          <CardDescription>
            All exchange rates are relative to INR (Indian Rupee) as the base
            currency.
          </CardDescription>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add Currency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Currency</DialogTitle>
              <DialogDescription>
                Add a new currency with its exchange rate relative to INR.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code
                </Label>
                <Input
                  id="code"
                  placeholder="USD"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  maxLength={3}
                  className="col-span-3 uppercase"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="US Dollar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="symbol" className="text-right">
                  Symbol
                </Label>
                <Input
                  id="symbol"
                  placeholder="$"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rate" className="text-right">
                  Rate (to INR)
                </Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="83.50"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                  resetAddForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddCurrency} disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Add Currency
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[80px]">Symbol</TableHead>
                <TableHead className="w-[200px]">
                  Exchange Rate (1 unit = X INR)
                </TableHead>
                <TableHead className="w-[150px]">Last Updated</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No currencies configured. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                currencies.map((currency) => {
                  const isBase = currency.code === "INR";
                  const isEditing = editingId === currency.id;

                  return (
                    <TableRow key={currency.id}>
                      {/* Code */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {currency.code}
                          </span>
                          {isBase && (
                            <Badge
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              Base
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>{currency.name}</TableCell>

                      {/* Symbol */}
                      <TableCell className="font-medium">
                        {currency.symbol}
                      </TableCell>

                      {/* Exchange Rate */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.000001"
                              min="0"
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              className="h-8 w-32"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveRate(currency.id);
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleSaveRate(currency.id)}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Check className="size-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleCancelEdit}
                              disabled={isPending}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono text-sm">
                            {isBase ? "1.000000" : Number(currency.exchangeRate).toFixed(6)}
                          </span>
                        )}
                      </TableCell>

                      {/* Last Updated */}
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(currency.lastUpdated)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        {isBase ? (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleStartEdit(currency)}
                              disabled={isPending || isEditing}
                              title="Edit exchange rate"
                            >
                              <RefreshCw className="size-3" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={isPending}
                                  title="Delete currency"
                                >
                                  <Trash2 className="size-3 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete {currency.code}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove the{" "}
                                    {currency.name} ({currency.code}) currency.
                                    Existing bookings using this currency will
                                    not be affected, but new bookings will no
                                    longer be able to use it.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    variant="destructive"
                                    onClick={() =>
                                      handleDelete(currency.id, currency.code)
                                    }
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
