import { Input, Label } from "veloria-app"

export function GuestNameField() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="guest-name">Primary contact</Label>
      <Input
        id="guest-name"
        defaultValue="Ananya Sharma"
        placeholder="Full name of the bride or groom's family contact"
      />
    </div>
  )
}

export function InputTypes() {
  return (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="enq-phone">Mobile number</Label>
        <Input id="enq-phone" type="tel" placeholder="+91 98450 12345" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="enq-email">Email</Label>
        <Input id="enq-email" type="email" defaultValue="ananya.sharma@gmail.com" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-date">Wedding date</Label>
        <Input id="event-date" type="date" defaultValue="2026-11-24" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pax">Expected guests (pax)</Label>
        <Input id="pax" type="number" defaultValue={650} />
      </div>
    </div>
  )
}

export function InvalidState() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="advance-amt">Advance amount (₹)</Label>
      <Input id="advance-amt" aria-invalid defaultValue="₹ 15,00,000" />
      <p className="text-sm text-muted-foreground">
        Advance cannot exceed the quoted total of ₹ 12,40,000
      </p>
    </div>
  )
}

export function DisabledState() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="booking-ref">Booking reference</Label>
      <Input id="booking-ref" disabled defaultValue="BKG-2026-0412 · Grand Orchid Hall" />
      <p className="text-sm text-muted-foreground">Auto-generated after confirmation</p>
    </div>
  )
}
