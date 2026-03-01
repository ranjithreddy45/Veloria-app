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
  quoteSchema,
  type QuoteInput,
} from "@/schemas/quote.schema";
import {
  createQuote,
  updateQuote,
} from "@/actions/quote.actions";
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

type Lead = {
  id: string;
  title: string;
  status: string;
  contactId?: string | null;
};

interface QuoteFormProps {
  contacts: Contact[];
  leads: Lead[];
  initialData?: QuoteInput & { id?: string };
  quoteId?: string;
}

// ============================================================
// Quote Form
// ============================================================

export function QuoteForm({
  contacts,
  leads,
  initialData,
  quoteId,
}: QuoteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactOpen, setContactOpen] = useState(false);

  const isEditing = !!quoteId;

  const form = useForm<QuoteInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: initialData ?? {
      title: "",
      contactId: "",
      leadId: "",
      packageId: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lineItems: [{ description: "", quantity: 1, unitPrice: 0, category: "" }],
      discountPercent: 0,
      taxRate: 18,
      notes: "",
      terms:
        "1. This quotation is valid for 30 days from the date of issue.\n2. Prices are inclusive of applicable taxes unless stated otherwise.\n3. A booking confirmation deposit of 50% is required to proceed.",
      coverLetter: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Watch values for live calculations
  const watchedLineItems = form.watch("lineItems");
  const watchedDiscount = form.watch("discountPercent") ?? 0;
  const watchedTaxRate = form.watch("taxRate") ?? 18;
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
    const taxAmount = (afterDiscount * (Number(watchedTaxRate) || 0)) / 100;
    const totalAmount = afterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      afterDiscount,
      taxAmount,
      totalAmount,
    };
  }, [watchedLineItems, watchedDiscount, watchedTaxRate]);

  // Handle contact change -> optionally auto-select lead
  const handleContactChange = (contactId: string) => {
    form.setValue("contactId", contactId);
    // If a lead is linked to this contact, auto-select it
    const matchingLead = leads.find((l) => l.contactId === contactId);
    if (matchingLead) {
      form.setValue("leadId", matchingLead.id);
    }
  };

  // Submit handler
  const onSubmit = (data: QuoteInput) => {
    startTransition(async () => {
      const result = isEditing
        ? await updateQuote(quoteId!, data)
        : await createQuote(data);

      if (result.success) {
        toast.success(
          isEditing ? "Quote updated successfully" : "Quote created successfully"
        );
        if (isEditing) {
          router.push(`/quotes/${quoteId}`);
        } else if (result.data && "id" in result.data) {
          router.push(`/quotes/${result.data.id}`);
        } else {
          router.push("/quotes");
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
            {/* Quote Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quote Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Wedding Reception Package"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Lead Selection */}
                  <FormField
                    control={form.control}
                    name="leadId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead (optional)</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select lead..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leads.map((lead) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Valid Until */}
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Valid Until *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
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
                </div>
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
                    append({ description: "", quantity: 1, unitPrice: 0, category: "" })
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
                    <div className="col-span-4">Description</div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-1">Qty</div>
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
                        <div className="sm:col-span-4">
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
                          <Label className="sm:hidden">Category</Label>
                          <Input
                            placeholder="e.g. Venue"
                            {...form.register(
                              `lineItems.${index}.category`
                            )}
                          />
                        </div>
                        <div className="sm:col-span-1">
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
                          <span className="font-medium text-sm">
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
                <CardTitle className="text-base">Discount & Tax</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  {/* Tax Rate */}
                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Rate (%)</FormLabel>
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
              </CardContent>
            </Card>

            {/* Cover Letter, Notes & Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Cover Letter, Notes & Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="coverLetter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Letter</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A personalized message to the client..."
                          rows={4}
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
                          placeholder="Quotation terms and conditions..."
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
                    ? "Update Quote"
                    : "Create Quote"}
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
                          <span className="font-medium">
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
                      <span>{formatINR(calculations.subtotal)}</span>
                    </div>
                    {calculations.discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>
                          Discount ({watchedDiscount}%)
                        </span>
                        <span>-{formatINR(calculations.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tax ({watchedTaxRate}%)
                      </span>
                      <span>{formatINR(calculations.taxAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span>{formatINR(calculations.totalAmount)}</span>
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
