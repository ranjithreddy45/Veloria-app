import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Separator,
} from "veloria-app";

export const BookingSummary = () => (
  <Card className="w-95">
    <CardHeader>
      <CardTitle>Sharma × Reddy Wedding</CardTitle>
      <CardDescription>Grand Orchid Hall · 14 Nov 2026 · 450 guests</CardDescription>
      <CardAction>
        <Badge>Confirmed</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Package</span>
          <span className="font-medium">Royal Banquet · Veg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Quoted</span>
          <span className="font-medium">₹18,50,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Advance received</span>
          <span className="font-medium">₹5,00,000</span>
        </div>
      </div>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Record payment</Button>
      <Button size="sm" variant="outline">
        View BEO
      </Button>
    </CardFooter>
  </Card>
);

export const SimpleContent = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Site visits this week</CardTitle>
      <CardDescription>Across both halls</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="font-display text-3xl font-semibold tracking-tight">12</p>
      <p className="text-muted-foreground mt-1 text-sm">4 more than last week</p>
    </CardContent>
  </Card>
);

export const WithFooterDivider = () => (
  <Card className="w-95">
    <CardHeader>
      <CardTitle>Vendor advance</CardTitle>
      <CardDescription>Floral & Decor — Bloomcraft Events</CardDescription>
    </CardHeader>
    <CardContent className="text-sm">
      Advance of <span className="font-medium">₹1,20,000</span> recorded against
      the Mehta engagement on 28 Sep. Netting applies on the final vendor
      invoice.
    </CardContent>
    <Separator />
    <CardFooter className="justify-between pt-0 [.border-t]:pt-6">
      <span className="text-muted-foreground text-xs">Updated 2h ago</span>
      <Button size="xs" variant="ghost">
        View ledger
      </Button>
    </CardFooter>
  </Card>
);
