import { ScrollArea, ScrollBar, Separator } from "veloria-app";

const guestFamilies = [
  "Sharma family — 12 guests",
  "Reddy family — 8 guests",
  "Iyer family — 15 guests",
  "Kapoor family — 6 guests",
  "Nair family — 10 guests",
  "Mehta family — 9 guests",
  "Rao family — 14 guests",
  "Deshpande family — 7 guests",
  "Chowdary family — 11 guests",
  "Patel family — 13 guests",
  "Menon family — 5 guests",
  "Gupta family — 16 guests",
];

export const GuestList = () => (
  <ScrollArea type="always" className="h-48 w-72 rounded-md border">
    <div className="p-4">
      <p className="mb-2 text-sm font-semibold">RSVP — Sharma wedding</p>
      {guestFamilies.map((entry) => (
        <div key={entry}>
          <div className="py-2 text-sm text-muted-foreground">{entry}</div>
          <Separator />
        </div>
      ))}
    </div>
  </ScrollArea>
);

const halls = [
  { name: "Grand Orchid Hall", cap: "1,200 pax" },
  { name: "Lotus Lawn", cap: "900 pax" },
  { name: "Pearl Pavilion", cap: "450 pax" },
  { name: "Jasmine Court", cap: "300 pax" },
  { name: "Marigold Terrace", cap: "250 pax" },
];

export const HallShelf = () => (
  <ScrollArea type="always" className="w-80 rounded-md border">
    <div className="flex gap-3 p-4" style={{ width: "max-content" }}>
      {halls.map((hall) => (
        <div
          key={hall.name}
          className="rounded-md border px-4 py-3"
          style={{ width: 160 }}
        >
          <p className="text-sm font-semibold">{hall.name}</p>
          <p className="text-xs text-muted-foreground">{hall.cap}</p>
        </div>
      ))}
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
);
