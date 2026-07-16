import { Label, Textarea } from "veloria-app"

export function SiteVisitNotes() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="visit-notes">Site visit notes</Label>
      <Textarea
        id="visit-notes"
        defaultValue="Family visited Lotus Lawn at 5 pm. Loved the mandap area near the fountain; asked whether 650 pax can be seated for the reception dinner. Follow up with revised quote by Thursday."
      />
    </div>
  )
}

export function WithPlaceholder() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="beo-instructions">Kitchen instructions for BEO</Label>
      <Textarea
        id="beo-instructions"
        placeholder="e.g. Jain menu for 40 guests at the head table, no onion or garlic; live dosa counter from 7:30 pm"
      />
    </div>
  )
}

export function InvalidState() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="cancel-reason">Cancellation reason</Label>
      <Textarea id="cancel-reason" aria-invalid defaultValue="n/a" />
      <p className="text-sm text-muted-foreground">
        Please give at least 20 characters — this goes on the refund record
      </p>
    </div>
  )
}

export function DisabledState() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="handover-summary">Handover summary</Label>
      <Textarea
        id="handover-summary"
        disabled
        defaultValue="Booking handed over to Operations on 12 Jul. Pearl Pavilion, mehendi + sangeet, vendor advances cleared."
      />
      <p className="text-sm text-muted-foreground">Locked after ops sign-off</p>
    </div>
  )
}
