"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, ChevronsUpDownIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { leadSchema, type LeadInput } from "@/schemas/lead.schema";
import { createLead, updateLead } from "@/actions/lead.actions";
import { EVENT_TYPES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

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

// ============================================================
// LeadForm Props
// ============================================================

interface LeadData {
  id: string;
  title: string;
  contactId: string;
  source: string;
  eventType: string | null;
  eventDate: Date | string | null;
  guestCount: number | null;
  estimatedValue: number | null;
  preferredVenueId: string | null;
  assignedToId?: string | null;
  slot: string | null;
  vegNonVeg: string | null;
  perPlateBudget: number | null;
  description: string | null;
}

interface LeadFormProps {
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  }[];
  venues?: { id: string; name: string }[];
  users?: { id: string; name: string | null }[];
  lead?: LeadData;
}

// ============================================================
// LeadForm Component
// ============================================================

export function LeadForm({ contacts, venues = [], users = [], lead }: LeadFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);

  const isEditing = !!lead;
  const preselectedContactId = lead?.contactId ?? searchParams.get("contactId") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema) as any,
    defaultValues: {
      title: lead?.title ?? "",
      contactId: preselectedContactId,
      source: (lead?.source ?? "WEBSITE") as LeadInput["source"],
      eventType: lead?.eventType ?? "",
      eventDate: lead?.eventDate ? new Date(lead.eventDate) : null,
      guestCount: lead?.guestCount ?? null,
      estimatedValue: lead?.estimatedValue ?? null,
      preferredVenueId: lead?.preferredVenueId ?? "",
      assignedToId: lead?.assignedToId ?? "",
      slot: (lead?.slot ?? "") as LeadInput["slot"],
      vegNonVeg: (lead?.vegNonVeg ?? "") as LeadInput["vegNonVeg"],
      perPlateBudget: lead?.perPlateBudget ?? null,
      description: lead?.description ?? "",
    },
  });

  async function onSubmit(data: LeadInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateLead(lead.id, data)
        : await createLead(data);
      if (result.success) {
        toast.success(isEditing ? "Lead updated successfully" : "Lead created successfully");
        router.push(isEditing ? `/leads/${lead.id}` : "/leads");
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
        {/* Lead Details */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Sharma Wedding Reception"
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
                                  ? `${c.firstName} ${c.lastName}`
                                  : "Select contact";
                              })()
                            : "Select contact"}
                          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search contacts..." />
                        <CommandList>
                          <CommandEmpty>No contacts found.</CommandEmpty>
                          <CommandGroup>
                            {contacts.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={`${contact.firstName} ${contact.lastName} ${contact.email ?? ""}`}
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
                                <div>
                                  <p className="text-sm font-medium">
                                    {contact.firstName} {contact.lastName}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {contact.email ?? contact.phone ?? "No contact info"}
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
              )}
            />

            {/* Source */}
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(LEAD_SOURCE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Event Information */}
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occasion</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select occasion" />
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

            {/* Event Date */}
            <FormField
              control={form.control}
              name="eventDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Event Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value
                            ? format(new Date(field.value), "dd MMM yyyy")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guestCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Count</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 200"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val ? parseInt(val, 10) : null);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                        &#8377;
                      </span>
                      <Input
                        type="number"
                        placeholder="e.g., 500000"
                        className="pl-8"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val ? parseFloat(val) : null);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preferred Venue */}
            <FormField
              control={form.control}
              name="preferredVenueId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Venue</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select venue" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {venues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slot */}
            <FormField
              control={form.control}
              name="slot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slot</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Lunch / Dinner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Lunch">Lunch</SelectItem>
                      <SelectItem value="Dinner">Dinner</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Veg / Non-Veg */}
            <FormField
              control={form.control}
              name="vegNonVeg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Food</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select preference" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Veg">Veg</SelectItem>
                      <SelectItem value="Non Veg">Non Veg</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assigned to */}
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned to</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Auto-assign by rules" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.length === 0 ? (
                        <div className="px-2 py-1.5 text-[12.5px] text-muted-foreground">
                          No assignable users.
                        </div>
                      ) : (
                        users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name ?? "Unnamed"}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Per-plate budget */}
            <FormField
              control={form.control}
              name="perPlateBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Per-plate Budget</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                        &#8377;
                      </span>
                      <Input
                        type="number"
                        placeholder="e.g., 1200"
                        className="pl-8"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val ? parseFloat(val) : null);
                        }}
                      />
                    </div>
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
                    <Textarea
                      placeholder="Additional details about this lead..."
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
            {isEditing ? "Update Lead" : "Create Lead"}
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
