"use client";

import React, { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { processRsvpResponse } from "@/actions/invitation.actions";
import { ConsentCheckbox } from "@/components/public/consent-checkbox";
import { CONSENT_TEXT_RSVP } from "@/lib/privacy/consent-text";

// ============================================================
// RSVP Form (Public — No Auth)
// ============================================================

interface RsvpFormProps {
  token: string;
  guestName: string;
}

interface MealCounts {
  veg: number;
  nonVeg: number;
  jain: number;
}

const MEAL_KINDS: { key: keyof MealCounts; label: string }[] = [
  { key: "veg", label: "Vegetarian" },
  { key: "nonVeg", label: "Non-vegetarian" },
  { key: "jain", label: "Jain" },
];

export function RsvpForm({ token, guestName }: RsvpFormProps) {
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState<"ACCEPTED" | "DECLINED" | null>(
    null
  );
  const [submitted, setSubmitted] = useState(false);
  const [plusOnes, setPlusOnes] = useState(0);
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  // Meal counts for the whole party. Answering is optional — an unanswered
  // party is reported to the kitchen as "unknown" rather than guessed at — so
  // these start null and are only sent once the guest has actually chosen.
  const [meals, setMeals] = useState<MealCounts | null>(null);

  const partySize = 1 + plusOnes;
  const mealTotal = meals ? meals.veg + meals.nonVeg + meals.jain : 0;
  // Only a STARTED answer can be wrong. Untouched stays silent.
  const mealsMismatch = meals != null && mealTotal !== partySize;

  function setMeal(kind: keyof MealCounts, value: number) {
    setMeals((prev) => {
      const base = prev ?? { veg: 0, nonVeg: 0, jain: 0 };
      return { ...base, [kind]: Math.max(0, value) };
    });
  }

  function handleSubmit(choice: "ACCEPTED" | "DECLINED") {
    if (!consent) {
      setConsentError("Please agree to the privacy notice to send your response.");
      return;
    }
    if (choice === "ACCEPTED" && mealsMismatch) {
      toast.error(`Your meal numbers add up to ${mealTotal}, but you're bringing ${partySize}.`);
      return;
    }
    setResponse(choice);

    startTransition(async () => {
      const sendMeals = choice === "ACCEPTED" && meals != null && !mealsMismatch;
      const result = await processRsvpResponse({
        token,
        response: choice,
        plusOnes: choice === "ACCEPTED" ? plusOnes : 0,
        dietaryRestrictions:
          choice === "ACCEPTED" ? dietaryRestrictions : undefined,
        ...(sendMeals
          ? { mealVeg: meals.veg, mealNonVeg: meals.nonVeg, mealJain: meals.jain }
          : {}),
        consent: true,
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
            <h3 className="font-editorial text-foreground mt-4 text-title font-semibold">
              Thank you, {guestName}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We&apos;re delighted you&apos;ll be joining us.
            </p>
          </>
        ) : (
          <>
            <XCircle className="text-muted-foreground/50 mx-auto size-11" />
            <h3 className="font-editorial text-foreground mt-4 text-title font-semibold">
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
          <Label htmlFor="plusOnes" className="text-muted-foreground text-body font-medium">
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

        {/* What the party eats. One tap for a single guest; counts once they
            bring others, because a non-veg guest arriving with three vegetarian
            relatives is three vegetarian covers, and the kitchen cooks to that.
            Optional throughout — skipping is honest, guessing is not. */}
        <div>
          <Label className="text-muted-foreground text-body font-medium">
            {partySize === 1 ? "What will you eat? (optional)" : "What will your group eat? (optional)"}
          </Label>

          {partySize === 1 ? (
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {MEAL_KINDS.map(({ key, label }) => {
                const selected = meals != null && meals[key] === 1;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="rounded-full"
                    aria-pressed={selected}
                    disabled={isPending}
                    onClick={() =>
                      setMeals(
                        selected
                          ? null // tapping the choice again clears it back to "not answered"
                          : { veg: 0, nonVeg: 0, jain: 0, [key]: 1 }
                      )
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1.5 space-y-2">
              {MEAL_KINDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-body">{label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={partySize}
                    inputMode="numeric"
                    aria-label={`${label} — how many of your ${partySize}`}
                    value={meals ? meals[key] : ""}
                    placeholder="0"
                    disabled={isPending}
                    onChange={(e) =>
                      setMeal(key, e.target.value === "" ? 0 : Number(e.target.value))
                    }
                    className="w-20 text-center"
                  />
                </div>
              ))}
              <p
                className={
                  mealsMismatch
                    ? "text-destructive text-meta font-medium"
                    : "text-muted-foreground text-meta"
                }
                role={mealsMismatch ? "alert" : undefined}
              >
                {meals == null
                  ? `Tell us how your ${partySize} split, or leave this blank.`
                  : `${mealTotal} of ${partySize} accounted for.`}
              </p>
            </div>
          )}
        </div>

        <div>
          <Label
            htmlFor="dietaryRestrictions"
            className="text-muted-foreground text-body font-medium"
          >
            Allergies or anything else? (optional)
          </Label>
          <Textarea
            id="dietaryRestrictions"
            value={dietaryRestrictions}
            onChange={(e) => setDietaryRestrictions(e.target.value)}
            className="mt-1.5 resize-none"
            rows={2}
            placeholder="e.g., nut allergy, gluten-free, no onion or garlic..."
          />
        </div>
        {/* No "note for your hosts" box: nothing on the invitation or guest record
            holds a reply message, so a note typed here would never reach the host. */}
      </div>

      {/* DPDP consent */}
      <ConsentCheckbox
        id="rsvp-consent"
        text={CONSENT_TEXT_RSVP}
        checked={consent}
        onCheckedChange={(v) => {
          setConsent(v);
          if (v) setConsentError(null);
        }}
        error={consentError}
        disabled={isPending}
      />

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
