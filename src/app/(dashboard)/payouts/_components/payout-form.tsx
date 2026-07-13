"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import {
  createPayoutSchema,
  type CreatePayoutInput,
} from "@/schemas/payout.schema";
import { createPayout } from "@/actions/payout.actions";
import { PAYOUT_TYPE_LABELS } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Props
// ============================================================

interface VendorOption {
  id: string;
  name: string;
  category: string;
}

interface BookingOption {
  id: string;
  bookingNumber: string;
  eventName: string;
  totalAmount: number;
}

interface BillOption {
  id: string;
  billNumber: string;
  vendorId: string;
  amount: number;
  outstanding: number;
}

interface PayoutFormProps {
  vendors: VendorOption[];
  bookings: BookingOption[];
  bills?: BillOption[];
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// ============================================================
// Type Options
// ============================================================

const typeOptions = Object.entries(PAYOUT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

// ============================================================
// PayoutForm Component
// ============================================================

export function PayoutForm({ vendors, bookings, bills = [] }: PayoutFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreatePayoutInput>({
    resolver: zodResolver(createPayoutSchema) as any,
    defaultValues: {
      amount: undefined,
      type: undefined,
      description: "",
      vendorId: "",
      bookingId: "",
      billId: "",
      notes: "",
    },
  });

  // The bill link only makes sense for a vendor payment; when a vendor is
  // chosen we narrow the list to that vendor's outstanding bills.
  const selectedType = form.watch("type");
  const selectedVendorId = form.watch("vendorId");
  const billOptions = React.useMemo(
    () =>
      selectedVendorId
        ? bills.filter((b) => b.vendorId === selectedVendorId)
        : bills,
    [bills, selectedVendorId]
  );

  // Drop a stale bill selection if it no longer belongs to the chosen vendor /
  // type, so we never submit a billId that isn't shown in the narrowed list.
  const selectedBillId = form.watch("billId");
  React.useEffect(() => {
    if (
      selectedBillId &&
      (selectedType !== "VENDOR_PAYMENT" ||
        !billOptions.some((b) => b.id === selectedBillId))
    ) {
      form.setValue("billId", "");
    }
  }, [selectedBillId, selectedType, billOptions, form]);

  async function onSubmit(data: CreatePayoutInput) {
    setIsPending(true);
    try {
      const result = await createPayout(data);

      if (result.success) {
        toast.success("Payout created successfully");
        router.push("/payouts");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Payout Details */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payout Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief description of this payout"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Associations */}
        <Card>
          <CardHeader>
            <CardTitle>Associations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select vendor (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bookingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select booking (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bookings.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.bookingNumber} - {booking.eventName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedType === "VENDOR_PAYMENT" && (
              <FormField
                control={form.control}
                name="billId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Bill (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              billOptions.length === 0
                                ? "No outstanding bills"
                                : "Link a vendor bill (optional)"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {billOptions.map((bill) => (
                          <SelectItem key={bill.id} value={bill.id}>
                            {bill.billNumber} — {inr.format(bill.outstanding)}{" "}
                            outstanding
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes or remarks..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Create Payout
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
