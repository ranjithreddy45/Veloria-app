import { Button } from "veloria-app";
import { CalendarPlus, Phone, Trash2, Download, Plus } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>New Booking</Button>
    <Button variant="secondary">Save Draft</Button>
    <Button variant="outline">Preview Quote</Button>
    <Button variant="ghost">Dismiss</Button>
    <Button variant="destructive">Cancel Event</Button>
    <Button variant="link">View contract</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="xs">Tag</Button>
    <Button size="sm">Follow up</Button>
    <Button size="default">Send Quote</Button>
    <Button size="lg">Confirm Booking</Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <CalendarPlus /> Schedule visit
    </Button>
    <Button variant="outline">
      <Download /> Export CSV
    </Button>
    <Button variant="secondary">
      <Phone /> Call lead
    </Button>
    <Button size="icon" aria-label="Add">
      <Plus />
    </Button>
    <Button size="icon-sm" variant="destructive" aria-label="Delete">
      <Trash2 />
    </Button>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Processing…</Button>
    <Button variant="outline" disabled>
      Locked
    </Button>
    <Button aria-invalid>Invalid action</Button>
  </div>
);
