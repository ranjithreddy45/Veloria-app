"use client";

import React, { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { processRsvpResponse } from "@/actions/invitation.actions";

// ============================================================
// RSVP Form (Public — No Auth)
// ============================================================

interface RsvpFormProps {
  token: string;
  guestName: string;
}

export function RsvpForm({ token, guestName }: RsvpFormProps) {
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState<"ACCEPTED" | "DECLINED" | null>(
    null
  );
  const [submitted, setSubmitted] = useState(false);
  const [plusOnes, setPlusOnes] = useState(0);
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(choice: "ACCEPTED" | "DECLINED") {
    setResponse(choice);

    startTransition(async () => {
      const result = await processRsvpResponse({
        token,
        response: choice,
        plusOnes: choice === "ACCEPTED" ? plusOnes : 0,
        dietaryRestrictions:
          choice === "ACCEPTED" ? dietaryRestrictions : undefined,
        message: message || undefined,
      });

      if (result.success) {
        setSubmitted(true);
        toast.success(
          choice === "ACCEPTED"
            ? "Thank you for accepting!"
            : "We'll miss you!"
        );
      } else {
        toast.error(result.error || "Something went wrong");
      }
    });
  }

  if (submitted) {
    return (
      <div className="py-8 text-center">
        {response === "ACCEPTED" ? (
          <>
            <CheckCircle2 className="mx-auto size-11 text-success" />
            <h3 className="font-editorial text-foreground mt-4 text-[22px] font-semibold">
              Thank you, {guestName}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We&apos;re delighted you&apos;ll be joining us.
            </p>
          </>
        ) : (
          <>
            <XCircle className="text-muted-foreground/50 mx-auto size-11" />
            <h3 className="font-editorial text-foreground mt-4 text-[22px] font-semibold">
              Thank you for letting us know
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We hope to welcome you at a future occasion.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optional Details */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="plusOnes" className="text-muted-foreground text-[13px] font-medium">
            Anyone joining you?
          </Label>
          <Input
            id="plusOnes"
            type="number"
            min={0}
            max={10}
            value={plusOnes}
            onChange={(e) => setPlusOnes(Number(e.target.value))}
            className="mt-1.5"
            placeholder="0"
          />
        </div>

        <div>
          <Label
            htmlFor="dietaryRestrictions"
            className="text-muted-foreground text-[13px] font-medium"
          >
            Dietary preferences (optional)
          </Label>
          <Textarea
            id="dietaryRestrictions"
            value={dietaryRestrictions}
            onChange={(e) => setDietaryRestrictions(e.target.value)}
            className="mt-1.5 resize-none"
            rows={2}
            placeholder="e.g., Vegetarian, Gluten-free, Nut allergy..."
          />
        </div>

        <div>
          <Label htmlFor="message" className="text-muted-foreground text-[13px] font-medium">
            A note for your hosts (optional)
          </Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1.5 resize-none"
            rows={2}
            placeholder="Send a personal note..."
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          className="flex-1 rounded-full bg-success hover:bg-success/90"
          size="lg"
          disabled={isPending}
          onClick={() => handleSubmit("ACCEPTED")}
        >
          {isPending && response === "ACCEPTED" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 size-4" />
          )}
          Accept
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-full"
          size="lg"
          disabled={isPending}
          onClick={() => handleSubmit("DECLINED")}
        >
          {isPending && response === "DECLINED" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 size-4" />
          )}
          Decline
        </Button>
      </div>
    </div>
  );
}
