import { Checkbox, Input, Label, Switch } from "veloria-app"

export function WithInput() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="lead-source">Lead source</Label>
      <Input id="lead-source" defaultValue="WedMeGood enquiry — Grand Orchid Hall" />
    </div>
  )
}

export function WithCheckbox() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="gst-invoice" defaultChecked />
      <Label htmlFor="gst-invoice">Issue GST invoice for this booking</Label>
    </div>
  )
}

export function WithSwitch() {
  return (
    <div className="flex items-center gap-2">
      <Switch id="valet" defaultChecked />
      <Label htmlFor="valet">Valet parking included</Label>
    </div>
  )
}

export function DisabledPeer() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox id="fire-noc" disabled />
        <Label htmlFor="fire-noc">Fire NOC verified (admin only)</Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quote-no">Quotation number</Label>
        <Input id="quote-no" disabled defaultValue="QTN-2026-1187" />
      </div>
    </div>
  )
}
