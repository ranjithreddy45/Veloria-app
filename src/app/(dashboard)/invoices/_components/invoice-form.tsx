"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  PlusIcon,
  Trash2Icon,
  CalendarIcon,
  CheckIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  invoiceSchema,
  type InvoiceInput,
} from "@/schemas/invoice.schema";
import {
  createInvoice,
  updateInvoice,
  getBookingsForInvoice,
} from "@/actions/invoice.actions";
import { INDIAN_STATES } from "@/lib/constants";
import { cn, formatINR } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// ============================================================
// Types
// ============================================================

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

type Booking = {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: Date | string;
  totalAmount: number | string | { toString(): string };
};

interface InvoiceFormProps {
  contacts: Contact[];
  bookings: Booking[];
  initialData?: InvoiceInput & { id?: string };
  invoiceId?: string;
}

// ============================================================
// Invoice Form
// ============================================================

export function InvoiceForm({
  contacts,
  bookings: initialBookings,
  initialData,
  invoiceId,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactOpen, setContactOpen] = useState(false);
  const [isInterstate, setIsInterstate] = useState(
    initialData ? (initialData.igstRate ?? 0) > 0 : false
  );
  const [filteredBookings, setFilteredBookings] = useState(initialBookings);

  const isEditing = !!invoiceId;

  const form = useForm<InvoiceInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: initialData ?? {
      contactId: "",
      bookingId: "",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
      discountPercent: 0,
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 0,
      notes: "",
      terms: "",
      gstin: "",
      placeOfSupply: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Watch values for live calculations
  const watchedLineItems = form.watch("lineItems");
  const watchedDiscount = form.watch("discountPercent") ?? 0;
  const watchedCgstRate = form.watch("cgstRate") ?? 9;
  const watchedSgstRate = form.watch("sgstRate") ?? 9;
  const watchedIgstRate = form.watch("igstRate") ?? 0;
  const watchedContactId = form.watch("contactId");

  // Live calculations
  const calculations = useMemo(() => {
    const subtotal = watchedLineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);

    const discountAmount = (subtotal * (Number(watchedDiscount) || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isInterstate) {
      igstAmount = (afterDiscount * (Number(watchedIgstRate) || 0)) / 100;
    } else {
      cgstAmount = (afterDiscount * (Number(watchedCgstRate) || 0)) / 100;
      sgstAmount = (afterDiscount * (Number(watchedSgstRate) || 0)) / 100;
    }

    const totalAmount = afterDiscount + cgstAmount + sgstAmount + igstAmount;

    return {
      subtotal,
      discountAmount,
      afterDiscount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
    };
  }, [
    watchedLineItems,
    watchedDiscount,
    watchedCgstRate,
    watchedSgstRate,
    watchedIgstRate,
    isInterstate,
  ]);

  // Handle contact change -> filter bookings
  const handleContactChange = async (contactId: string) => {
    form.setValue("contactId", contactId);
    form.setValue("bookingId", "");

    if (contactId) {
      const result = await getBookingsForInvoice(contactId);
      if (result.success && result.data) {
        setFilteredBookings(result.data);
      }
    } else {
      setFilteredBookings(initialBookings);
    }
  };

  // Handle interstate toggle
  const handleInterstateToggle = (checked: boolean) => {
    setIsInterstate(checked);
    if (checked) {
      form.setValue("cgstRate", 0);
      form.setValue("sgstRate", 0);
      form.setValue("igstRate", 18);
    } else {
      form.setValue("cgstRate", 9);
      form.setValue("sgstRate", 9);
      form.setValue("igstRate", 0);
    }
  };

  // Submit handler
  const onSubmit = (data: InvoiceInput) => {
    startTransition(async () => {
      const result = isEditing
        ? await updateInvoice(invoiceId!, data)
        : await createInvoice(data);

      if (result.success) {
        toast.success(
          isEditing ? "Invoice updated successfully" : "Invoice created successfully"
        );
        if (isEditing) {
          router.push(`/invoices/${invoiceId}`);
        } else if (result.data && "id" in result.data) {
          router.push(`/invoices/${result.data.id}`);
        } else {
          router.push("/invoices");
        }
      } else {
        toast.error(result.error || "Something went wrong");
      }
    });
  };

  const selectedContact = contacts.find((c) => c.id === watchedContactId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Form Fields */}
          <div className="space-y-6 xl:col-span-2">
            {/* Contact & Booking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contact Combobox */}
                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Contact *</FormLabel>
                      <Popover open={contactOpen} onOpenChange={setContactOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={contactOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? (() => {
                                    const c = contacts.find(
                                      (c) => c.id === field.value
                                    );
                                    return c
                                      ? `${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ""}`
                                      : "Select contact...";
                                  })()
                                : "Select contact..."}
                              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search contacts..." />
                            <CommandList>
                              <CommandEmpty>No contact found.</CommandEmpty>
                              <CommandGroup>
                                {contacts.map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={`${contact.firstName} ${contact.lastName} ${contact.company || ""}`}
                                    onSelect={() => {
                                      handleContactChange(contact.id);
                                      setContactOpen(false);
                                    }}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 size-4",
                                        contact.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div className="font-medium">
                                        {contact.firstName} {contact.lastName}
                                      </div>
                                      {contact.company && (
                                        <div className="text-xs text-muted-foreground">
                                          {contact.company}
                                        </div>
                                      )}
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
                  )}
                />

                {/* Booking Selection */}
                <FormField
                  control={form.control}
                  name="bookingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking (optional)</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select booking..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredBookings.map((booking) => (
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* GSTIN */}
                  <FormField
                    control={form.control}
                    name="gstin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client GSTIN</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 29ABCDE1234F1Z5"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Place of Supply */}
                  <FormField
                    control={form.control}
                    name="placeOfSupply"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Place of Supply</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select state..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDIAN_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal sm:w-[260px]",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? format(new Date(field.value), "PPP")
                                : "Pick a date"}
                              <CalendarIcon className="ml-auto size-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Line Items</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ description: "", quantity: 1, unitPrice: 0 })
                  }
                >
                  <PlusIcon className="mr-1 size-4" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="hidden grid-cols-12 gap-2 text-xs font-medium text-muted-foreground sm:grid">
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">Unit Price</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-1" />
                  </div>

                  {fields.map((field, index) => {
                    const qty = Number(watchedLineItems[index]?.quantity) || 0;
                    const price =
                      Number(watchedLineItems[index]?.unitPrice) || 0;
                    const lineAmount = qty * price;

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-12 sm:border-0 sm:p-0"
                      >
                        <div className="sm:col-span-5">
                          <Label className="sm:hidden">Description</Label>
                          <Input
                            placeholder="Item description"
                            {...form.register(
                              `lineItems.${index}.description`
                            )}
                          />
                          {form.formState.errors.lineItems?.[index]
                            ?.description && (
                            <p className="text-xs text-destructive mt-1">
                              {
                                form.formState.errors.lineItems[index]
                                  ?.description?.message
                              }
                            </p>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="sm:hidden">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="1"
                            {...form.register(
                              `lineItems.${index}.quantity`,
                              { valueAsNumber: true }
                            )}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="sm:hidden">Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...form.register(
                              `lineItems.${index}.unitPrice`,
                              { valueAsNumber: true }
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-end sm:col-span-2">
                          <span className="numeric text-[13px] font-semibold">
                            {formatINR(lineAmount)}
                          </span>
                        </div>
                        <div className="flex items-center sm:col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => fields.length > 1 && remove(index)}
                            disabled={fields.length <= 1}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Discount & Tax */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discount & Taxes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Discount */}
                <FormField
                  control={form.control}
                  name="discountPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0"
                          className="w-full sm:w-32"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : parseFloat(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Interstate Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isInterstate}
                    onCheckedChange={handleInterstateToggle}
                  />
                  <Label>
                    {isInterstate
                      ? "Interstate (IGST)"
                      : "Intrastate (CGST + SGST)"}
                  </Label>
                </div>

                {/* Tax Rates */}
                {isInterstate ? (
                  <FormField
                    control={form.control}
                    name="igstRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IGST Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            className="w-full sm:w-32"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="cgstRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CGST Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-full sm:w-32"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sgstRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SGST Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-full sm:w-32"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes & Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes for the client..."
                          rows={3}
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
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Payment terms and conditions..."
                          rows={4}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Invoice"
                    : "Create Invoice"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Right: Live Preview Panel */}
          <div className="xl:col-span-1">
            <div className="sticky top-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* Bill To */}
                  {selectedContact && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        Bill To
                      </div>
                      <div className="font-medium">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </div>
                      {selectedContact.company && (
                        <div className="text-muted-foreground">
                          {selectedContact.company}
                        </div>
                      )}
                      {selectedContact.email && (
                        <div className="text-muted-foreground">
                          {selectedContact.email}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Line Items */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Items ({watchedLineItems.length})
                    </div>
                    {watchedLineItems.map((item, i) => {
                      const qty = Number(item.quantity) || 0;
                      const price = Number(item.unitPrice) || 0;
                      return (
                        <div
                          key={i}
                          className="flex justify-between py-1 text-xs"
                        >
                          <span className="truncate max-w-[140px]">
                            {item.description || "Item " + (i + 1)}
                          </span>
                          <span className="numeric font-medium">
                            {formatINR(qty * price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  {/* Calculations */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="numeric">{formatINR(calculations.subtotal)}</span>
                    </div>
                    {calculations.discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>
                          Discount ({watchedDiscount}%)
                        </span>
                        <span className="numeric">-{formatINR(calculations.discountAmount)}</span>
                      </div>
                    )}
                    {!isInterstate ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            CGST ({watchedCgstRate}%)
                          </span>
                          <span className="numeric">{formatINR(calculations.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            SGST ({watchedSgstRate}%)
                          </span>
                          <span className="numeric">{formatINR(calculations.sgstAmount)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          IGST ({watchedIgstRate}%)
                        </span>
                        <span className="numeric">{formatINR(calculations.igstAmount)}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-baseline justify-between border-t pt-2.5 text-[17px] font-bold">
                      <span>Total</span>
                      <span className="numeric">{formatINR(calculations.totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
