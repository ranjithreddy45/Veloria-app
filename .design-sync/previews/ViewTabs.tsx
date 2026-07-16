import { useState } from "react";
import { ViewTabs } from "veloria-app";
import { LayoutList, Kanban, CalendarDays, MapPin } from "lucide-react";

export const Default = () => {
  const [view, setView] = useState("list");
  return (
    <ViewTabs
      value={view}
      onValueChange={setView}
      options={[
        { value: "list", label: "List", icon: LayoutList },
        { value: "board", label: "Board", icon: Kanban },
      ]}
    />
  );
};

export const BookingsViews = () => {
  const [view, setView] = useState("calendar");
  return (
    <div className="flex w-96 items-center justify-between">
      <p className="text-sm font-medium">Bookings</p>
      <ViewTabs
        value={view}
        onValueChange={setView}
        options={[
          { value: "list", label: "List", icon: LayoutList },
          { value: "board", label: "Board", icon: Kanban },
          { value: "calendar", label: "Calendar", icon: CalendarDays },
        ]}
      />
    </div>
  );
};

export const TextOnly = () => {
  const [view, setView] = useState("upcoming");
  return (
    <ViewTabs
      value={view}
      onValueChange={setView}
      options={[
        { value: "upcoming", label: "Upcoming" },
        { value: "past", label: "Past events" },
        { value: "all", label: "All" },
      ]}
    />
  );
};

export const SiteVisits = () => {
  const [view, setView] = useState("map");
  return (
    <ViewTabs
      value={view}
      onValueChange={setView}
      options={[
        { value: "list", label: "List", icon: LayoutList },
        { value: "map", label: "Halls", icon: MapPin },
        { value: "calendar", label: "Slots", icon: CalendarDays },
      ]}
    />
  );
};
