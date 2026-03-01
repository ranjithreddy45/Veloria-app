export const siteConfig = {
  name: "Veloria Grand",
  description:
    "Veloria Grand - Premium Venue & Event Management Platform. Manage bookings, leads, invoices, and client relationships all in one place.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og.png",
  links: {
    website: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  creator: "Veloria Grand",
  keywords: [
    "venue management",
    "event management",
    "booking system",
    "CRM",
    "invoice management",
  ],
} as const;

export type SiteConfig = typeof siteConfig;
