import { Label, RadioGroup, RadioGroupItem } from "veloria-app";

export const EventType = () => (
  <RadioGroup defaultValue="wedding" className="w-72">
    <div className="flex items-center gap-3">
      <RadioGroupItem value="wedding" id="rg-ev-wedding" />
      <Label htmlFor="rg-ev-wedding">Wedding</Label>
    </div>
    <div className="flex items-center gap-3">
      <RadioGroupItem value="reception" id="rg-ev-reception" />
      <Label htmlFor="rg-ev-reception">Reception</Label>
    </div>
    <div className="flex items-center gap-3">
      <RadioGroupItem value="engagement" id="rg-ev-engagement" />
      <Label htmlFor="rg-ev-engagement">Engagement</Label>
    </div>
    <div className="flex items-center gap-3">
      <RadioGroupItem value="corporate" id="rg-ev-corporate" />
      <Label htmlFor="rg-ev-corporate">Corporate event</Label>
    </div>
  </RadioGroup>
);

export const HallSlot = () => (
  <RadioGroup defaultValue="evening" className="w-80">
    <div className="flex items-start gap-3">
      <RadioGroupItem value="morning" id="rg-slot-morning" className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-slot-morning">Morning slot</Label>
        <p className="text-xs text-muted-foreground">6:00 AM – 3:00 PM · Grand Orchid Hall</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <RadioGroupItem value="evening" id="rg-slot-evening" className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-slot-evening">Evening slot</Label>
        <p className="text-xs text-muted-foreground">4:00 PM – 11:00 PM · Grand Orchid Hall</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <RadioGroupItem value="fullday" id="rg-slot-fullday" className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-slot-fullday">Full day</Label>
        <p className="text-xs text-muted-foreground">6:00 AM – 11:00 PM · includes both slots</p>
      </div>
    </div>
  </RadioGroup>
);

export const PaymentPlanDisabled = () => (
  <RadioGroup defaultValue="advance50" className="w-80">
    <div className="flex items-start gap-3">
      <RadioGroupItem value="advance50" id="rg-pay-50" className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-pay-50">50% advance</Label>
        <p className="text-xs text-muted-foreground">₹4,17,500 now, balance 7 days before event</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <RadioGroupItem value="advance25" id="rg-pay-25" className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-pay-25">25% advance</Label>
        <p className="text-xs text-muted-foreground">₹2,08,750 now, two instalments after</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <RadioGroupItem value="postevent" id="rg-pay-post" disabled className="mt-0.5" />
      <div className="grid gap-1">
        <Label htmlFor="rg-pay-post" className="text-muted-foreground">
          Pay after event
        </Label>
        <p className="text-xs text-muted-foreground">Corporate accounts only — not available for this booking</p>
      </div>
    </div>
  </RadioGroup>
);
