import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  Label,
} from "veloria-app";

export const Default = () => (
  <div className="flex w-64 flex-col gap-2">
    <Label htmlFor="hall">Hall</Label>
    <Select defaultValue="orchid">
      <SelectTrigger id="hall" className="w-full">
        <SelectValue placeholder="Choose a hall" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="orchid">Grand Orchid Hall</SelectItem>
        <SelectItem value="lotus">Lotus Lawn</SelectItem>
        <SelectItem value="pearl">Pearl Pavilion</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Placeholder = () => (
  <div className="flex w-64 flex-col gap-2">
    <Label htmlFor="slot">Event slot</Label>
    <Select>
      <SelectTrigger id="slot" className="w-full">
        <SelectValue placeholder="Select a slot" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="morning">Morning (8am – 3pm)</SelectItem>
        <SelectItem value="evening">Evening (5pm – 11pm)</SelectItem>
        <SelectItem value="fullday">Full day</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const OpenWithGroups = () => (
  <div className="h-72 w-64">
    <Select defaultOpen defaultValue="wedding">
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Weddings</SelectLabel>
          <SelectItem value="wedding">Wedding reception</SelectItem>
          <SelectItem value="engagement">Engagement</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Corporate</SelectLabel>
          <SelectItem value="conference">Conference</SelectItem>
          <SelectItem value="offsite">Team offsite</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);

export const Disabled = () => (
  <div className="flex w-64 flex-col gap-2">
    <Label htmlFor="locked">Assigned manager</Label>
    <Select disabled defaultValue="priya">
      <SelectTrigger id="locked" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="priya">Priya N. (Ops Head)</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
