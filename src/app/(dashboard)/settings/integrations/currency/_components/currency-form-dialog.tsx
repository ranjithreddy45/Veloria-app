"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCurrency, updateCurrency } from "@/actions/currency.actions";

// ============================================================
// Types
// ============================================================

interface CurrencyData {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyData | null;
}

// ============================================================
// CurrencyFormDialog Component
// ============================================================

export function CurrencyFormDialog({
  open,
  onOpenChange,
  currency,
}: CurrencyFormDialogProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  // Form state
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [exchangeRate, setExchangeRate] = React.useState("");

  const isEditMode = !!currency;

  // Reset form when dialog opens/currency changes
  React.useEffect(() => {
    if (open) {
      if (currency) {
        setCode(currency.code);
        setName(currency.name);
        setSymbol(currency.symbol);
        setExchangeRate(String(currency.exchangeRate));
      } else {
        setCode("");
        setName("");
        setSymbol("");
        setExchangeRate("");
      }
    }
  }, [open, currency]);

  async function handleSubmit() {
    if (!code.trim() || code.trim().length !== 3) {
      toast.error("Currency code must be exactly 3 characters");
      return;
    }
    if (!name.trim()) {
      toast.error("Currency name is required");
      return;
    }
    if (!symbol.trim()) {
      toast.error("Symbol is required");
      return;
    }
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Exchange rate must be a positive number");
      return;
    }

    setIsPending(true);
    try {
      const formData = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim(),
        exchangeRate: rate,
      };

      if (isEditMode) {
        const result = await updateCurrency(currency.id, formData);
        if (result.success) {
          toast.success(`Currency ${formData.code} updated successfully`);
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createCurrency(formData);
        if (result.success) {
          toast.success(`Currency ${formData.code} added successfully`);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Currency" : "Add New Currency"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the currency details below."
              : "Add a new currency with its exchange rate relative to INR."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="currency-code">Currency Code *</Label>
            <Input
              id="currency-code"
              placeholder="USD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={3}
              className="uppercase"
              disabled={isEditMode}
            />
            {isEditMode && (
              <p className="text-xs text-muted-foreground">
                Currency code cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="currency-name">Name *</Label>
            <Input
              id="currency-name"
              placeholder="US Dollar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Symbol */}
          <div className="space-y-2">
            <Label htmlFor="currency-symbol">Symbol *</Label>
            <Input
              id="currency-symbol"
              placeholder="$"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>

          {/* Exchange Rate */}
          <div className="space-y-2">
            <Label htmlFor="currency-rate">Exchange Rate (1 unit = X INR) *</Label>
            <Input
              id="currency-rate"
              type="number"
              step="0.000001"
              min="0"
              placeholder="83.50"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many INR does 1 unit of this currency equal?
            </p>
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
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isEditMode ? "Update Currency" : "Add Currency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
