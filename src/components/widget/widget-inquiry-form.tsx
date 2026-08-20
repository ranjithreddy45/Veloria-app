"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, CheckCircleIcon } from "lucide-react";
import {
  widgetInquirySchema,
  type WidgetInquiryInput,
} from "@/schemas/widget.schema";
import { EVENT_TYPES } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
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
// Venue Type
// ============================================================

interface Venue {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
}

// ============================================================
// WidgetInquiryForm Props
// ============================================================

interface WidgetInquiryFormProps {
  venues?: Venue[];
}

/**
 * Local-time "YYYY-MM-DD" for the date input's `min`. NOT toISOString(): that
 * is UTC and the browser evaluates `min` against the local wall-clock date, so
 * a UTC-derived min is off by a day for part of every day in IST (UTC+5:30).
 */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ============================================================
// WidgetInquiryForm Component
// ============================================================

export function WidgetInquiryForm({ venues = [] }: WidgetInquiryFormProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<WidgetInquiryInput>({
    resolver: zodResolver(widgetInquirySchema) as any,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      eventType: undefined,
      eventDate: null,
      guestCount: null,
      venueId: "",
      message: "",
    },
  });

  async function onSubmit(data: WidgetInquiryInput) {
    setIsPending(true);
    try {
      const response = await fetch("/api/widget/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          eventDate: data.eventDate
            ? new Date(data.eventDate).toISOString()
            : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSubmitted(true);
        form.reset();
      } else {
        // Set field errors from API response
        if (result.details) {
          Object.entries(result.details).forEach(([field, message]) => {
            form.setError(field as keyof WidgetInquiryInput, {
              message: message as string,
            });
          });
        }
      }
    } catch {
      form.setError("root", {
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  // Success state
  if (isSubmitted) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircleIcon className="mb-4 size-16 text-emerald-500" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            Thank You!
          </h2>
          <p className="mb-6 text-muted-foreground">
            Your inquiry has been submitted successfully. Our team will get back
            to you shortly.
          </p>
          <Button
            variant="outline"
            onClick={() => setIsSubmitted(false)}
          >
            Submit Another Inquiry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Book Your Event</CardTitle>
        <CardDescription>
          Fill out the form below and our team will get back to you within 24
          hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Root error */}
            {form.formState.errors.root && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {form.formState.errors.root.message}
              </div>
            )}

            {/* Name & Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phone & Event Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
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
                    <FormLabel>Event Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
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
            </div>

            {/* Event Date & Guest Count */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value
                            ? new Date(field.value)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val ? new Date(val) : null);
                        }}
                        min={todayLocal()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Guests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="100"
                        min={1}
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
            </div>

            {/* Venue Select */}
            {venues.length > 0 && (
              <FormField
                control={form.control}
                name="venueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Venue</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a venue" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {venues.map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name}
                            {venue.capacity
                              ? ` (up to ${venue.capacity} guests)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about your event, any special requirements, or questions you have..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {isPending ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
