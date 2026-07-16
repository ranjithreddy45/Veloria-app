import { Label, Switch } from "veloria-app"

export function HallAvailabilityToggle() {
  return (
    <div className="flex items-center gap-2">
      <Switch id="hall-live" defaultChecked />
      <Label htmlFor="hall-live">Grand Orchid Hall open for bookings</Label>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="sz-default" size="default" defaultChecked />
        <Label htmlFor="sz-default">Payment reminders (default)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="sz-sm" size="sm" defaultChecked />
        <Label htmlFor="sz-sm">WhatsApp nudges (sm)</Label>
      </div>
    </div>
  )
}

export function States() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="st-off" />
        <Label htmlFor="st-off">Muhurtham premium pricing</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="st-on" defaultChecked />
        <Label htmlFor="st-on">Auto-send quote follow-ups</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="st-dis-off" disabled />
        <Label htmlFor="st-dis-off">Vendor self-service portal</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="st-dis-on" disabled defaultChecked />
        <Label htmlFor="st-dis-on">GST on invoices (mandatory)</Label>
      </div>
    </div>
  )
}

export function NotificationSettings() {
  return (
    <div className="flex w-80 flex-col gap-4">
      <span className="text-sm font-medium">Event-day reminders</span>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="rem-48h">48h guest confirmation</Label>
        <Switch id="rem-48h" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="rem-vendor">Vendor call-time alerts</Label>
        <Switch id="rem-vendor" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="rem-sms">SMS fallback when WhatsApp fails</Label>
        <Switch id="rem-sms" />
      </div>
    </div>
  )
}
