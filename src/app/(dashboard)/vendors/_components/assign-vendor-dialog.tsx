"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import {
  assignVendorSchema,
  type AssignVendorInput,
} from "@/schemas/vendor.schema";
import { assignVendorToBooking } from "@/actions/vendor.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
// AssignVendorDialog Props
// ============================================================

interface Booking {
  id: string;
  bookingNumber: string;
  eventName: string;
}

interface AssignVendorDialogProps {
  vendorId: string;
  vendorName: string;
  bookings: Booking[];
}

// ============================================================
// AssignVendorDialog Component
// ============================================================

export function AssignVendorDialog({
  vendorId,
  vendorName,
  bookings,
}: AssignVendorDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [selectedBookingId, setSelectedBookingId] = React.useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<AssignVendorInput>({
    resolver: zodResolver(assignVendorSchema) as any,
    defaultValues: {
      role: "",
      agreedRate: undefined,
      notes: "",
    },
  });

  async function onSubmit(data: AssignVendorInput) {
    if (!selectedBookingId) {
      toast.error("Please select a booking");
      return;
    }

    setIsPending(true);
    try {
      const result = await assignVendorToBooking(
        selectedBookingId,
        vendorId,
        data
      );

      if (result.success) {
        toast.success(`${vendorName} assigned to booking successfully`);
        setOpen(false);
        form.reset();
        setSelectedBookingId("");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 size-4" />
          Assign to Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {vendorName} to a Booking</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Booking Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Booking *</label>
              <Select
                value={selectedBookingId}
                onValueChange={setSelectedBookingId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No bookings available
                    </SelectItem>
                  ) : (
                    bookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.bookingNumber} - {booking.eventName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Lead Photographer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agreedRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreed Rate (INR)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="50000"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val ? Number(val) : undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this assignment..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Assign Vendor
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
