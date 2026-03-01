"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  deleteCurrency,
  updateExchangeRate,
  convertAmount,
} from "@/actions/currency.actions";
import { CurrencyFormDialog } from "./currency-form-dialog";

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

interface CurrencyManagerProps {
  currencies: Currency[];
}

// ============================================================
// CurrencyManager Component
// ============================================================

export function CurrencyManager({ currencies }: CurrencyManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

  // Inline rate editing state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState("");

  // Conversion calculator state
  const [convAmount, setConvAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [convResult, setConvResult] = useState<{
    convertedAmount: number;
    exchangeRate: number;
    fromCurrency: string;
    toCurrency: string;
  } | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // ----------------------------------------------------------
  // Add / Edit Currency Dialog
  // ----------------------------------------------------------

  function handleOpenAdd() {
    setEditingCurrency(null);
    setFormDialogOpen(true);
  }

  function handleOpenEdit(currency: Currency) {
    setEditingCurrency(currency);
    setFormDialogOpen(true);
  }

  // ----------------------------------------------------------
  // Inline Edit Exchange Rate
  // ----------------------------------------------------------

  function handleStartRateEdit(currency: Currency) {
    setEditingRateId(currency.id);
    setEditRateValue(String(currency.exchangeRate));
  }

  function handleCancelRateEdit() {
    setEditingRateId(null);
    setEditRateValue("");
  }

  function handleSaveRate(id: string) {
    const rate = parseFloat(editRateValue);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Exchange rate must be a positive number");
      return;
    }

    startTransition(async () => {
      const result = await updateExchangeRate(id, rate);
      if (result.success) {
        toast.success("Exchange rate updated");
        setEditingRateId(null);
        setEditRateValue("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ----------------------------------------------------------
  // Delete Currency
  // ----------------------------------------------------------

  function handleDelete(id: string, code: string) {
    startTransition(async () => {
      const result = await deleteCurrency(id);
      if (result.success) {
        toast.success(`Currency ${code} deleted`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ----------------------------------------------------------
  // Currency Conversion
  // ----------------------------------------------------------

  async function handleConvert() {
    const amount = parseFloat(convAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!fromCurrency) {
      toast.error("Please select a source currency");
      return;
    }
    if (!toCurrency) {
      toast.error("Please select a target currency");
      return;
    }

    setIsConverting(true);
    try {
      const result = await convertAmount(amount, fromCurrency, toCurrency);
      if (result.success) {
        setConvResult(result.data);
      } else {
        toast.error(result.error);
        setConvResult(null);
      }
    } catch {
      toast.error("Conversion failed");
      setConvResult(null);
    } finally {
      setIsConverting(false);
    }
  }

  // ----------------------------------------------------------
  // Date formatting helper
  // ----------------------------------------------------------

  function formatLastUpdated(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Currencies Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Currencies</CardTitle>
            <CardDescription>
              All exchange rates are relative to INR (Indian Rupee) as the base
              currency.
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="size-4" />
            Add Currency
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[80px]">Symbol</TableHead>
                  <TableHead className="w-[220px]">
                    Exchange Rate (1 unit = X INR)
                  </TableHead>
                  <TableHead className="w-[150px]">Last Updated</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>
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
                    const isEditingRate = editingRateId === currency.id;

                    return (
                      <TableRow
                        key={currency.id}
                        className={
                          isBase
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : undefined
                        }
                      >
                        {/* Code */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">
                              {currency.code}
                            </span>
                            {isBase && (
                              <Badge
                                variant="outline"
                                className="text-xs font-normal border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400"
                              >
                                Base Currency
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
                          {isEditingRate ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.000001"
                                min="0"
                                value={editRateValue}
                                onChange={(e) =>
                                  setEditRateValue(e.target.value)
                                }
                                className="h-8 w-32"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleSaveRate(currency.id);
                                  } else if (e.key === "Escape") {
                                    handleCancelRateEdit();
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
                                onClick={handleCancelRateEdit}
                                disabled={isPending}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="font-mono text-sm">
                              {isBase
                                ? "1.000000"
                                : Number(currency.exchangeRate).toFixed(6)}
                            </span>
                          )}
                        </TableCell>

                        {/* Last Updated */}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastUpdated(currency.lastUpdated)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          {isBase ? (
                            <span className="text-xs text-muted-foreground">
                              --
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit currency details */}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleOpenEdit(currency)}
                                disabled={isPending || isEditingRate}
                                title="Edit currency"
                              >
                                <Pencil className="size-3" />
                              </Button>

                              {/* Inline rate edit */}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleStartRateEdit(currency)}
                                disabled={isPending || isEditingRate}
                                title="Edit exchange rate"
                              >
                                <ArrowRightLeft className="size-3" />
                              </Button>

                              {/* Delete */}
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
                                      {currency.name} ({currency.code})
                                      currency. Existing bookings using this
                                      currency will not be affected, but new
                                      bookings will no longer be able to use it.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() =>
                                        handleDelete(
                                          currency.id,
                                          currency.code
                                        )
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

      {/* Currency Conversion Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Currency Converter</CardTitle>
          <CardDescription>
            Quickly convert amounts between configured currencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Amount */}
            <div className="space-y-2 sm:w-40">
              <Label htmlFor="conv-amount">Amount</Label>
              <Input
                id="conv-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="1000"
                value={convAmount}
                onChange={(e) => {
                  setConvAmount(e.target.value);
                  setConvResult(null);
                }}
              />
            </div>

            {/* From Currency */}
            <div className="space-y-2 sm:w-44">
              <Label>From</Label>
              <Select
                value={fromCurrency}
                onValueChange={(val) => {
                  setFromCurrency(val);
                  setConvResult(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Currency */}
            <div className="space-y-2 sm:w-44">
              <Label>To</Label>
              <Select
                value={toCurrency}
                onValueChange={(val) => {
                  setToCurrency(val);
                  setConvResult(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Convert Button */}
            <Button
              onClick={handleConvert}
              disabled={isConverting || !convAmount || !fromCurrency || !toCurrency}
            >
              {isConverting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="size-4" />
              )}
              Convert
            </Button>
          </div>

          {/* Conversion Result */}
          {convResult && (
            <div className="mt-4 rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Result</p>
              <p className="text-2xl font-semibold tracking-tight">
                {convResult.convertedAmount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  {convResult.toCurrency}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                1 {convResult.fromCurrency} = {convResult.exchangeRate}{" "}
                {convResult.toCurrency}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency Form Dialog */}
      <CurrencyFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        currency={editingCurrency}
      />
    </div>
  );
}
