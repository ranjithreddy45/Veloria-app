"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  CalendarIcon,
  ChevronsUpDownIcon,
  CheckIcon,
} from "lucide-react";

import { bookingSchema, type BookingInput } from "@/schemas/booking.schema";
import {
  createBooking,
  updateBooking,
  checkAvailability,
} from "@/actions/booking.actions";
import { EVENT_TYPES, TIME_SLOT_LABELS } from "@/lib/constants";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface VenueOption {
  id: string;
  name: string;
  capacity: number;
  pricePerSlot: unknown;
  isActive: boolean;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

interface BookingData {
  id: string;
  eventName: string;
  eventType: string;
  venueId: string;
  contactId: string;
  date: Date | string;
  timeSlot: string;
  guestCount: number;
  totalAmount: unknown;
  hallBooked?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  perPlatePrice?: unknown;
  hallRental?: unknown;
  decorCharges?: unknown;
  otherServices?: unknown;
  specialRequests: string | null;
  internalNotes: string | null;
}

// Format a Date/string into the value a <input type="datetime-local"> expects.
function toLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface BookingFormProps {
  booking?: BookingData;
  venues: VenueOption[];
  contacts: ContactOption[];
  defaultDate?: string;
  defaultTimeSlot?: string;
}

// ============================================================
// BookingForm Component
// ============================================================

export function BookingForm({
  booking,
  venues,
  contacts,
  defaultDate,
  defaultTimeSlot,
}: BookingFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  // Availability state
  const [availability, setAvailability] = React.useState<{
    checked: boolean;
    available: boolean;
    reason: string | null;
    loading: boolean;
  }>({ checked: false, available: false, reason: null, loading: false });

  const isEditing = !!booking;

  // Parse default date if provided
  const parsedDefaultDate = defaultDate ? new Date(defaultDate) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema) as any,
    defaultValues: {
      eventName: booking?.eventName ?? "",
      eventType: booking?.eventType ?? "",
      venueId: booking?.venueId ?? "",
      contactId: booking?.contactId ?? "",
      date: booking?.date ? new Date(booking.date) : (parsedDefaultDate ?? undefined),
      timeSlot: (booking?.timeSlot ?? defaultTimeSlot ?? undefined) as BookingInput["timeSlot"],
      guestCount: booking?.guestCount ?? 0,
      totalAmount: booking?.totalAmount ? Number(booking.totalAmount) : 0,
      hallBooked: booking?.hallBooked ?? "",
      eventStart: booking?.startTime ? new Date(booking.startTime) : null,
      eventEnd: booking?.endTime ? new Date(booking.endTime) : null,
      perPlatePrice: booking?.perPlatePrice ? Number(booking.perPlatePrice) : undefined,
      hallRental: booking?.hallRental ? Number(booking.hallRental) : undefined,
      decorCharges: booking?.decorCharges ? Number(booking.decorCharges) : undefined,
      otherServices: booking?.otherServices ? Number(booking.otherServices) : undefined,
      specialRequests: booking?.specialRequests ?? "",
      internalNotes: booking?.internalNotes ?? "",
    },
  });

  const watchedVenueId = form.watch("venueId");
  const watchedDate = form.watch("date");
  const watchedTimeSlot = form.watch("timeSlot");

  // Auto-check availability when all three fields are set
  React.useEffect(() => {
    if (watchedVenueId && watchedDate && watchedTimeSlot) {
      checkSlotAvailability();
    } else {
      setAvailability({ checked: false, available: false, reason: null, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedVenueId, watchedDate, watchedTimeSlot]);

  async function checkSlotAvailability() {
    if (!watchedVenueId || !watchedDate || !watchedTimeSlot) return;

    setAvailability({ checked: false, available: false, reason: null, loading: true });

    try {
      const result = await checkAvailability(
        watchedVenueId,
        new Date(watchedDate),
        watchedTimeSlot as "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY"
      );

      if (result.success && result.data) {
        setAvailability({
          checked: true,
          available: result.data.available,
          reason: result.data.reason,
          loading: false,
        });
      } else {
        setAvailability({
          checked: true,
          available: false,
          reason: result.error || "Could not check availability",
          loading: false,
        });
      }
    } catch {
      setAvailability({
        checked: true,
        available: false,
        reason: "Error checking availability",
        loading: false,
      });
    }
  }

  // Selected venue for capacity display
  const selectedVenue = venues.find((v) => v.id === watchedVenueId);

  async function onSubmit(data: BookingInput) {
    // Guard against a double-click racing a second create through before the
    // first request settles / navigation kicks in.
    if (isPending) return;
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateBooking(booking.id, data)
        : await createBooking(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Booking updated successfully"
            : "Booking created successfully"
        );
        // Redirect to the created/updated booking and keep the button busy
        // through navigation so a second submit can't create a duplicate.
        const targetId = isEditing ? booking.id : result.data.id;
        router.push(`/bookings/${targetId}`);
        router.refresh();
        return; // leave isPending=true; the page is unmounting
      }

      toast.error(result.error);
      setIsPending(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="eventName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Event Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Sharma-Patel Wedding Reception"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
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
              name="guestCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Count *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g., 200"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? 0 : parseInt(val, 10));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hallBooked"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hall Booked</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Grand Ballroom, Hall A"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Start</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(field.value as Date | string | null)}
                      onChange={(e) =>
                        field.onChange(e.target.value ? new Date(e.target.value) : null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event End</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(field.value as Date | string | null)}
                      onChange={(e) =>
                        field.onChange(e.target.value ? new Date(e.target.value) : null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialRequests"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Special Requests</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special requirements, dietary restrictions, decoration preferences..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 2: Venue & Date */}
        <Card>
          <CardHeader>
            <CardTitle>Venue & Date</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="venueId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select venue" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {venues
                        .filter((v) => v.isActive)
                        .map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name} (Cap: {venue.capacity})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedVenue && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Capacity: {selectedVenue.capacity} guests | Price per slot:{" "}
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(Number(selectedVenue.pricePerSlot))}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "dd MMM yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto size-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Time Slot *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {Object.entries(TIME_SLOT_LABELS).map(([key, label]) => (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            field.value === key
                              ? "border-indigo-300 bg-indigo-50"
                              : "hover:border-border"
                          )}
                        >
                          <RadioGroupItem value={key} id={`slot-${key}`} />
                          <Label
                            htmlFor={`slot-${key}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Availability Indicator */}
            {(availability.loading || availability.checked) && (
              <div className="sm:col-span-2">
                {availability.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Checking availability...
                  </div>
                ) : availability.available ? (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                    <CheckCircle2Icon className="size-4" />
                    Slot is available
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    <XCircleIcon className="size-4" />
                    {availability.reason || "Slot unavailable"}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Client</span>
              <Button variant="outline" size="sm" asChild>
                <a href="/contacts/new" target="_blank" rel="noopener noreferrer">
                  New Contact
                </a>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => {
                const selectedContact = contacts.find(
                  (c) => c.id === field.value
                );

                return (
                  <FormItem>
                    <FormLabel>Contact *</FormLabel>
                    <Popover open={contactOpen} onOpenChange={setContactOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedContact
                              ? `${selectedContact.firstName} ${selectedContact.lastName}${
                                  selectedContact.company
                                    ? ` (${selectedContact.company})`
                                    : ""
                                }`
                              : "Search contacts..."}
                            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, email, or company..." />
                          <CommandList>
                            <CommandEmpty>No contacts found.</CommandEmpty>
                            <CommandGroup>
                              {contacts.map((contact) => (
                                <CommandItem
                                  key={contact.id}
                                  value={`${contact.firstName} ${contact.lastName} ${contact.email || ""} ${contact.company || ""}`}
                                  onSelect={() => {
                                    field.onChange(contact.id);
                                    setContactOpen(false);
                                  }}
                                >
                                  <CheckIcon
                                    className={cn(
                                      "mr-2 size-4",
                                      field.value === contact.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {contact.firstName} {contact.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {[contact.email, contact.phone, contact.company]
                                        .filter(Boolean)
                                        .join(" | ")}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </CardContent>
        </Card>

        {/* Section 4: Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { name: "perPlatePrice", label: "Per Plate Price", hint: "₹ per guest plate" },
                  { name: "hallRental", label: "Hall Rental" },
                  { name: "decorCharges", label: "Decor Charges" },
                  { name: "otherServices", label: "Other Services" },
                ] as const
              ).map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            className="pl-7"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                          />
                        </div>
                      </FormControl>
                      {"hint" in f && f.hint ? (
                        <p className="text-xs text-muted-foreground">{f.hint}</p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* Computed component subtotal helper */}
            {(() => {
              const guests = Number(form.watch("guestCount")) || 0;
              const plates = (Number(form.watch("perPlatePrice")) || 0) * guests;
              const components =
                plates +
                (Number(form.watch("hallRental")) || 0) +
                (Number(form.watch("decorCharges")) || 0) +
                (Number(form.watch("otherServices")) || 0);
              if (components <= 0) return null;
              const fmt = (n: number) =>
                new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(n);
              return (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Components total
                    {guests > 0 && plates > 0 ? ` (incl. ${guests} plates)` : ""}: {fmt(components)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue("totalAmount", components)}
                  >
                    Apply to Total
                  </Button>
                </div>
              );
            })()}

            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem className="max-w-sm">
                  <FormLabel>Total Amount (INR) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 500000"
                        className="pl-7"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </FormControl>
                  {field.value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(Number(field.value))}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Internal Notes (optional) */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (internal only)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this booking, not visible to client..."
                      rows={3}
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
          <Button
            type="submit"
            disabled={isPending || (availability.checked && !availability.available)}
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Booking" : "Create Booking"}
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
