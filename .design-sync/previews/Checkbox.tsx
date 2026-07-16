import { Checkbox, Label } from "veloria-app"

export function BookingChecklistItem() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="advance-received" defaultChecked />
      <Label htmlFor="advance-received">Advance of ₹ 3,00,000 received</Label>
    </div>
  )
}

export function States() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="tnc-unchecked" />
        <Label htmlFor="tnc-unchecked">Guest T&amp;C confirmation pending</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="beo-signed" defaultChecked />
        <Label htmlFor="beo-signed">BEO signed by kitchen head</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="hall-locked" disabled />
        <Label htmlFor="hall-locked">Pearl Pavilion blocked (ops only)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="dj-license" disabled defaultChecked />
        <Label htmlFor="dj-license">DJ sound license attached</Label>
      </div>
    </div>
  )
}

export function InvalidState() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox id="vendor-tnc" aria-invalid />
        <Label htmlFor="vendor-tnc">Vendor accepted advance terms</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Required before releasing the decor advance
      </p>
    </div>
  )
}

export function EventReadinessGroup() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <span className="text-sm font-medium">Event-day readiness — Lotus Lawn</span>
      <div className="flex items-center gap-2">
        <Checkbox id="rd-mandap" defaultChecked />
        <Label htmlFor="rd-mandap">Mandap decor complete</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="rd-genset" defaultChecked />
        <Label htmlFor="rd-genset">Backup genset tested</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="rd-caterer" />
        <Label htmlFor="rd-caterer">Caterer check-in confirmed</Label>
      </div>
    </div>
  )
}
