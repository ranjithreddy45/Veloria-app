"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  contractSchema,
  type ContractInput,
} from "@/schemas/contract.schema";
import {
  createContract,
  updateContract,
  getBookingsForContract,
} from "@/actions/contract.actions";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";

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
};

type Booking = {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: Date | string;
  totalAmount: number | string | { toString(): string };
  venue?: { name: string } | null;
};

type Template = {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  variables: string[];
  category?: string | null;
};

interface ContractFormProps {
  contacts: Contact[];
  bookings: Booking[];
  templates: Template[];
  initialData?: ContractInput & { id?: string };
  contractId?: string;
}

// ============================================================
// Contract Form
// ============================================================

export function ContractForm({
  contacts,
  bookings: initialBookings,
  templates,
  initialData,
  contractId,
}: ContractFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactOpen, setContactOpen] = useState(false);
  const [filteredBookings, setFilteredBookings] = useState(initialBookings);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  const isEditing = !!contractId;

  const form = useForm<ContractInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(contractSchema) as any,
    defaultValues: initialData ?? {
      title: "",
      content: "",
      contactId: "",
      bookingId: "",
      templateId: "",
      signerName: "",
      signerEmail: "",
      expiresAt: null,
      notes: "",
    },
  });

  const watchedContactId = form.watch("contactId");
  const watchedContent = form.watch("content");

  // Handle contact change -> filter bookings + auto-fill signer
  const handleContactChange = async (contactId: string) => {
    form.setValue("contactId", contactId);
    form.setValue("bookingId", "");

    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      if (!form.getValues("signerName")) {
        form.setValue(
          "signerName",
          `${contact.firstName} ${contact.lastName}`
        );
      }
      if (!form.getValues("signerEmail") && contact.email) {
        form.setValue("signerEmail", contact.email);
      }
    }

    if (contactId) {
      const result = await getBookingsForContract(contactId);
      if (result.success && result.data) {
        setFilteredBookings(result.data);
      }
    } else {
      setFilteredBookings(initialBookings);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      form.setValue("templateId", templateId);
      form.setValue("content", template.content);
      if (!form.getValues("title")) {
        form.setValue("title", template.name);
      }
    }
  };

  // Preview content with variable replacement
  const getPreviewContent = () => {
    let content = watchedContent || "";
    const contact = contacts.find((c) => c.id === watchedContactId);
    const bookingId = form.getValues("bookingId");
    const booking = filteredBookings.find((b) => b.id === bookingId);

    const variables: Record<string, string> = {
      clientName: contact
        ? `${contact.firstName} ${contact.lastName}`
        : "{{clientName}}",
      eventDate: booking
        ? format(new Date(booking.date), "dd MMM yyyy")
        : "{{eventDate}}",
      venueName: booking?.venue?.name ?? "{{venueName}}",
      totalAmount: booking
        ? Number(booking.totalAmount).toLocaleString("en-IN")
        : "{{totalAmount}}",
      bookingNumber: booking?.bookingNumber ?? "{{bookingNumber}}",
      signerName: form.getValues("signerName") || "{{signerName}}",
      signerEmail: form.getValues("signerEmail") || "{{signerEmail}}",
      company: contact?.company ?? "{{company}}",
      email: contact?.email ?? "{{email}}",
      phone: contact?.phone ?? "{{phone}}",
    };

    content = content.replace(
      /\{\{(\w+)\}\}/g,
      (match, key) => variables[key] ?? match
    );

    return content;
  };

  // Detect variables in content
  const detectedVariables = Array.from(
    new Set(
      (watchedContent?.match(/\{\{(\w+)\}\}/g) || []).map((v: string) =>
        v.replace(/\{\{|\}\}/g, "")
      )
    )
  );

  // Submit handler
  const onSubmit = (data: ContractInput) => {
    startTransition(async () => {
      const result = isEditing
        ? await updateContract(contractId!, data)
        : await createContract(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Contract updated successfully"
            : "Contract created successfully"
        );
        if (isEditing) {
          router.push(`/contracts/${contractId}`);
        } else if (result.data && "id" in result.data) {
          router.push(`/contracts/${result.data.id}`);
        } else {
          router.push("/contracts");
        }
      } else {
        toast.error(result.error || "Something went wrong");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Form Fields */}
          <div className="space-y-6 xl:col-span-2">
            {/* Template Selector */}
            {!isEditing && templates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileTextIcon className="size-4" />
                    Start from Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template.id)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30",
                          selectedTemplate?.id === template.id &&
                            "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/50"
                        )}
                      >
                        <div className="font-medium text-sm">
                          {template.name}
                        </div>
                        {template.description && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </div>
                        )}
                        {template.category && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-[10px]"
                          >
                            {template.category}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contract Details</CardTitle>
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
                          placeholder="e.g. Wedding Event Agreement"
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
                  {/* Signer Name */}
                  <FormField
                    control={form.control}
                    name="signerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signer Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Full name of signer"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Signer Email */}
                  <FormField
                    control={form.control}
                    name="signerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signer Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="signer@example.com"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Expiry Date */}
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date (optional)</FormLabel>
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
                                : "Pick an expiry date"}
                              <CalendarIcon className="ml-auto size-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value
                                ? new Date(field.value)
                                : undefined
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

            {/* Contract Content */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contract Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Content *
                        {detectedVariables.length > 0 && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Use {"{{variableName}}"} for placeholders
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter contract content... Use {{clientName}}, {{eventDate}}, {{venueName}}, etc. for dynamic values."
                          rows={16}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {detectedVariables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">
                      Detected variables:
                    </span>
                    {detectedVariables.map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="text-xs font-mono"
                      >
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes (not visible to client)..."
                          rows={3}
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
                    ? "Update Contract"
                    : "Create Contract"}
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
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SparklesIcon className="size-4" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* Title Preview */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      Title
                    </div>
                    <div className="font-medium">
                      {form.watch("title") || "Untitled Contract"}
                    </div>
                  </div>

                  <Separator />

                  {/* Signer Info */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      Signer
                    </div>
                    <div>
                      {form.watch("signerName") || "--"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {form.watch("signerEmail") || "--"}
                    </div>
                  </div>

                  <Separator />

                  {/* Content Preview */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Content Preview
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap dark:bg-muted/10">
                      {getPreviewContent() || "No content yet..."}
                    </div>
                  </div>

                  {/* Variables Status */}
                  {detectedVariables.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                          Variables ({detectedVariables.length})
                        </div>
                        {detectedVariables.map((v) => {
                          const preview = getPreviewContent();
                          const isReplaced = !preview.includes(`{{${v}}}`);
                          return (
                            <div
                              key={v}
                              className="flex items-center justify-between py-0.5"
                            >
                              <span className="font-mono text-xs">
                                {`{{${v}}}`}
                              </span>
                              <span
                                className={`text-xs ${isReplaced ? "text-green-600" : "text-amber-600"}`}
                              >
                                {isReplaced ? "Resolved" : "Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
