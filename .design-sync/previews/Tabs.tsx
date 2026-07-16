import { Tabs, TabsList, TabsTrigger, TabsContent } from "veloria-app";
import { CalendarDays, IndianRupee, Users } from "lucide-react";

export const Default = () => (
  <Tabs defaultValue="overview" className="w-96">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="payments">Payments</TabsTrigger>
      <TabsTrigger value="vendors">Vendors</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">
      <div className="rounded-xl border p-4 text-sm">
        <p className="font-medium">Sharma × Reddy Wedding</p>
        <p className="text-muted-foreground">
          Grand Orchid Hall · 14 Nov 2026 · Evening slot · 650 guests
        </p>
      </div>
    </TabsContent>
    <TabsContent value="payments">
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Advance ₹2,50,000 received · Balance ₹6,80,000 due 1 Nov
      </div>
    </TabsContent>
    <TabsContent value="vendors">
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        4 vendors confirmed · Decor pending T&amp;C acceptance
      </div>
    </TabsContent>
  </Tabs>
);

export const LineVariant = () => (
  <Tabs defaultValue="quotes" className="w-96">
    <TabsList variant="line">
      <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
      <TabsTrigger value="quotes">Quotations</TabsTrigger>
      <TabsTrigger value="bookings">Bookings</TabsTrigger>
      <TabsTrigger value="lost">Lost</TabsTrigger>
    </TabsList>
    <TabsContent value="quotes">
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        12 open quotations · ₹48.2L pipeline · 3 expiring this week
      </div>
    </TabsContent>
  </Tabs>
);

export const WithIcons = () => (
  <Tabs defaultValue="schedule" className="w-96">
    <TabsList>
      <TabsTrigger value="schedule">
        <CalendarDays /> Schedule
      </TabsTrigger>
      <TabsTrigger value="guests">
        <Users /> Guests
      </TabsTrigger>
      <TabsTrigger value="billing">
        <IndianRupee /> Billing
      </TabsTrigger>
    </TabsList>
    <TabsContent value="schedule">
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Muhurtham 10:40 AM · Reception 7:00 PM · Lotus Lawn
      </div>
    </TabsContent>
  </Tabs>
);

export const Vertical = () => (
  <Tabs defaultValue="beo" orientation="vertical" className="w-96">
    <TabsList>
      <TabsTrigger value="beo">BEO</TabsTrigger>
      <TabsTrigger value="kitchen">Kitchen</TabsTrigger>
      <TabsTrigger value="logistics">Logistics</TabsTrigger>
    </TabsList>
    <TabsContent value="beo">
      <div className="h-full rounded-xl border p-4 text-sm text-muted-foreground">
        Banquet Event Order · Pearl Pavilion · Menu locked, floor plan v3 approved
      </div>
    </TabsContent>
  </Tabs>
);
