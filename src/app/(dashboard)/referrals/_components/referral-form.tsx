"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronsUpDownIcon, CheckIcon, Loader2Icon } from "lucide-react";
import {
  createReferralSchema,
  type CreateReferralInput,
} from "@/schemas/referral.schema";
import { createReferral } from "@/actions/referral.actions";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ============================================================
// Types
// ============================================================

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface ReferralFormProps {
  contacts: ContactOption[];
}

// ============================================================
// ReferralForm Component
// ============================================================

export function ReferralForm({ contacts }: ReferralFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateReferralInput>({
    resolver: zodResolver(createReferralSchema) as any,
    defaultValues: {
      referrerContactId: "",
      referredName: "",
      referredEmail: "",
      referredPhone: "",
      notes: "",
    },
  });

  async function onSubmit(data: CreateReferralInput) {
    setIsPending(true);
    try {
      const result = await createReferral(data);

      if (result.success) {
        toast.success("Referral created successfully");
        router.push("/referrals");
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
        {/* Referrer Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Referrer Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="referrerContactId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Referring Contact *</FormLabel>
                  <Popover
                    open={contactOpen}
                    onOpenChange={setContactOpen}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? (() => {
                                const contact = contacts.find(
                                  (c) => c.id === field.value
                                );
                                return contact
                                  ? `${contact.firstName} ${contact.lastName}`
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
                                value={`${contact.firstName} ${contact.lastName} ${contact.email || ""}`}
                                onSelect={() => {
                                  field.onChange(contact.id);
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
                                  <p className="font-medium">
                                    {contact.firstName} {contact.lastName}
                                  </p>
                                  {contact.email && (
                                    <p className="text-xs text-muted-foreground">
                                      {contact.email}
                                    </p>
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
          </CardContent>
        </Card>

        {/* Referred Person Details */}
        <Card>
          <CardHeader>
            <CardTitle>Referred Person Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="referredName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter the referred person's name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referredEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referredPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      placeholder="Any additional context about this referral..."
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
            Create Referral
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
