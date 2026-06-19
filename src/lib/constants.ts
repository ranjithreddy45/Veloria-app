// ============================================================
// App Info
// ============================================================

export const APP_NAME = "Veloria Grand" as const;

// ============================================================
// Company Configuration (override via environment variables)
// ============================================================

export const COMPANY_ADDRESS =
  process.env.NEXT_PUBLIC_COMPANY_ADDRESS ||
  "123 Celebration Avenue, Event City, Karnataka 560001";

export const COMPANY_GSTIN =
  process.env.NEXT_PUBLIC_COMPANY_GSTIN || "";

export const COMPANY_PHONE =
  process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 80 1234 5678";

export const COMPANY_EMAIL =
  process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@veloriagrand.com";

// ============================================================
// Event Types
// ============================================================

// Event types — aligned 1:1 with the Veloria Grand Zoho Bookings module.
export const EVENT_TYPES = [
  "Anniversary",
  "Baby Shower",
  "Bachelor Party",
  "Birthday Party",
  "Cocktail Party",
  "Conference",
  "Corporate Event",
  "Corporate Party",
  "Engagement",
  "Fresher Party",
  "Get-together",
  "Haldi",
  "Kids Party",
  "Mehandi",
  "Naming Ceremony",
  "New Year Party",
  "Pre-Wedding Shoot",
  "Reception",
  "Sangeet",
  "Seminar",
  "Team Outing",
  "Wedding",
  "Other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// ============================================================
// Time Slot Labels
// ============================================================

export const TIME_SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning (8:00 AM - 12:00 PM)",
  AFTERNOON: "Afternoon (12:00 PM - 5:00 PM)",
  EVENING: "Evening (5:00 PM - 11:00 PM)",
  FULL_DAY: "Full Day (8:00 AM - 11:00 PM)",
} as const;

// ============================================================
// Booking Status Colors
// ============================================================

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  HOLD: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  TENTATIVE: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  IN_PROGRESS: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  COMPLETED: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

// ============================================================
// Lead Status Colors
// ============================================================

export const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  CONTACTED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  QUALIFIED: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  PROPOSAL_SENT: "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40",
  NEGOTIATION: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  LOST: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

// ============================================================
// Task Priority Colors
// ============================================================

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  URGENT: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

// ============================================================
// Indian States & Union Territories (for GST Place of Supply)
// ============================================================

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

// ============================================================
// Lead Source Labels
// ============================================================

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social Media",
  WALK_IN: "Walk-in",
  PHONE_INQUIRY: "Phone Inquiry",
  EMAIL: "Email",
  EVENT: "Event",
  PARTNER: "Partner",
  ADVERTISEMENT: "Advertisement",
  FACEBOOK_ADS: "Facebook Ads",
  GOOGLE_ADS: "Google Ads",
  INDIAMART: "IndiaMart",
  JUSTDIAL: "JustDial",
  WEDMEGOOD: "WedMeGood",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
} as const;

export const LEAD_SOURCE_COLORS: Record<string, string> = {
  WEBSITE: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  REFERRAL: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  SOCIAL_MEDIA: "bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800/40",
  WALK_IN: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  PHONE_INQUIRY: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  EMAIL: "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40",
  EVENT: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  PARTNER: "bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/40",
  ADVERTISEMENT: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  FACEBOOK_ADS: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  GOOGLE_ADS: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  INDIAMART: "bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/40",
  JUSTDIAL: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  WEDMEGOOD: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40",
  INSTAGRAM: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40",
  WHATSAPP: "bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/40",
  OTHER: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
} as const;

// ============================================================
// Invoice Status Colors
// ============================================================

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  OVERDUE: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  CANCELLED: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  REFUNDED: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Payment Status Colors
// ============================================================

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  FAILED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  REFUNDED: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Quote Status Colors
// ============================================================

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  VIEWED: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  REJECTED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  EXPIRED: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  CONVERTED: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Contract Status Colors
// ============================================================

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  VIEWED: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  SIGNED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  EXPIRED: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

// ============================================================
// Vendor Status Colors
// ============================================================

export const VENDOR_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  INACTIVE: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  BLACKLISTED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  PENDING_APPROVAL: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
} as const;

// ============================================================
// Vendor Category Labels
// ============================================================

export const VENDOR_CATEGORY_LABELS: Record<string, string> = {
  CATERING: "Catering",
  DECORATION: "Decoration",
  PHOTOGRAPHY: "Photography",
  VIDEOGRAPHY: "Videography",
  ENTERTAINMENT: "Entertainment",
  FLORIST: "Florist",
  TRANSPORTATION: "Transportation",
  LIGHTING: "Lighting",
  SOUND: "Sound",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  RENTAL: "Rental",
  OTHER: "Other",
} as const;

// ============================================================
// Vendor Bid & Assignment Status Colors
// ============================================================

export const VENDOR_BID_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  REJECTED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

export const VENDOR_ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
} as const;

// ============================================================
// Package Tier Colors
// ============================================================

export const PACKAGE_TIER_COLORS: Record<string, string> = {
  BASIC: "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  STANDARD: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  PREMIUM: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  CUSTOM: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Pricing Rule Type Labels
// ============================================================

export const PRICING_RULE_TYPE_LABELS: Record<string, string> = {
  SEASONAL: "Seasonal",
  DAY_OF_WEEK: "Day of Week",
  PEAK_HOUR: "Peak Hour",
  EARLY_BIRD: "Early Bird",
  LAST_MINUTE: "Last Minute",
} as const;

// ============================================================
// Pricing Rule Type Colors
// ============================================================

export const PRICING_RULE_TYPE_COLORS: Record<string, string> = {
  SEASONAL: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  DAY_OF_WEEK: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  PEAK_HOUR: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  EARLY_BIRD: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  LAST_MINUTE: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Day of Week Labels
// ============================================================

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
} as const;

// ============================================================
// Phase 6: Event Operations Colors
// ============================================================

export const OPERATION_STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  READY: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  LIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  COMPLETED: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
};

export const STAFF_ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  CHECKED_IN: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
};

export const TIMELINE_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  LIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  COMPLETED: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
};

export const TIMELINE_ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
  IN_PROGRESS: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  DONE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  SKIPPED: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
};

export const RSVP_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
  ACCEPTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  DECLINED: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export const GUEST_CATEGORY_LABELS: Record<string, string> = {
  VIP: "VIP",
  FAMILY: "Family",
  FRIEND: "Friend",
  CORPORATE: "Corporate",
  OTHER: "Other",
};

export const WORKFLOW_TRIGGER_LABELS: Record<string, string> = {
  EVENT_CREATED: "Event Created",
  BOOKING_CONFIRMED: "Booking Confirmed",
  PAYMENT_DUE: "Payment Due",
  EVENT_TOMORROW: "Event Tomorrow",
  POST_EVENT: "Post Event",
  LEAD_CREATED: "Lead Created",
};

export const WORKFLOW_LOG_STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

// ============================================================
// Phase 6.3: Catering Menu Management
// ============================================================

export const MENU_CATEGORIES = [
  "Starters",
  "Main Course",
  "Desserts",
  "Beverages",
  "Live Counters",
  "Salads",
  "Breads",
  "Rice & Biryani",
  "Accompaniments",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export const MENU_CUISINES = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Continental",
  "Mughlai",
  "Street Food",
  "Pan Asian",
] as const;

export type MenuCuisine = (typeof MENU_CUISINES)[number];

export const DIETARY_TAGS = [
  "Vegetarian",
  "Vegan",
  "Non-Vegetarian",
  "Gluten Free",
  "Jain",
  "Sugar Free",
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

// ============================================================
// Phase 7: Resources, Inventory & Staffing Colors
// ============================================================

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  EQUIPMENT: "Equipment",
  VEHICLE: "Vehicle",
  VENUE_ADDON: "Venue Add-on",
  OTHER: "Other",
};

export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  RESERVED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  IN_USE: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  RETURNED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  DAMAGED: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export const SHIFT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  CHECKED_IN: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  ABSENT: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export const PAYROLL_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
  APPROVED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  PAID: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

export const RENTAL_STATUS_COLORS: Record<string, string> = {
  RESERVED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  RENTED: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  RETURNED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  OVERDUE: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export const TABLE_SHAPE_LABELS: Record<string, string> = {
  ROUND: "Round",
  RECTANGULAR: "Rectangular",
  LONG: "Long",
};

export const INVENTORY_CATEGORIES = [
  "Furniture",
  "Linen",
  "Tableware",
  "Decoration",
  "Lighting",
  "Audio/Visual",
  "Kitchen Equipment",
  "Outdoor",
  "Safety",
  "Miscellaneous",
] as const;

export const RENTAL_CATEGORIES = [
  "Tent & Marquee",
  "Furniture",
  "Stage & Platform",
  "Lighting",
  "Sound System",
  "Generator",
  "Cooling/Heating",
  "Dance Floor",
  "Photo Booth",
  "Other",
] as const;

// ============================================================
// Phase 8: Finance & Accounting Colors
// ============================================================

export const PAYOUT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

export const PAYOUT_TYPE_LABELS: Record<string, string> = {
  VENDOR_PAYMENT: "Vendor Payment",
  OWNER_PAYOUT: "Owner Payout",
  COMMISSION: "Commission",
};

export const COMMISSION_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
};

export const ACCOUNTING_SYNC_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  SYNCED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  FAILED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  EVENT_LIABILITY: "Event Liability",
  PROPERTY: "Property",
  CANCELLATION: "Cancellation",
  WEATHER: "Weather",
};

export const INSURANCE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  EXPIRED: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  CLAIMED: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
};

export const BUDGET_CATEGORIES = [
  "Venue Operations",
  "Marketing",
  "Staff Costs",
  "Equipment",
  "Maintenance",
  "Utilities",
  "Insurance",
  "Miscellaneous",
] as const;

// ============================================================
// Phase 9: CRM, Marketing & Communications
// ============================================================

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  SENDING: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  SENT: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

export const COMMUNICATION_TYPE_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  SMS: "SMS",
  MEETING: "Meeting",
  WHATSAPP: "WhatsApp",
};

export const COMMUNICATION_TYPE_COLORS: Record<string, string> = {
  NOTE: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
  CALL: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  EMAIL: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
  SMS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  MEETING: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  WHATSAPP: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

export const WHATSAPP_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  DELIVERED: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  READ: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export const REFERRAL_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  CONTACTED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  CONVERTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  EXPIRED: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
};

export const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TWITTER: "Twitter",
  LINKEDIN: "LinkedIn",
};

export const SOCIAL_POST_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400",
  SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  POSTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

export const EMAIL_TEMPLATE_CATEGORIES = [
  "Booking Confirmation",
  "Payment Receipt",
  "Reminder",
  "Follow-up",
  "Promotion",
  "Welcome",
  "Thank You",
  "General",
] as const;

// ============================================================
// Call Disposition Labels & Colors
// ============================================================

export const CALL_DISPOSITION_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  NO_ANSWER: "No Answer",
  BUSY: "Busy",
  VOICEMAIL: "Voicemail",
  WRONG_NUMBER: "Wrong Number",
  CALLBACK_REQUESTED: "Callback Requested",
} as const;

export const CALL_DISPOSITION_COLORS: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  NO_ANSWER: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  BUSY: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  VOICEMAIL: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  WRONG_NUMBER: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  CALLBACK_REQUESTED: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Telephony Provider Labels & Colors
// ============================================================

export const TELEPHONY_PROVIDER_LABELS: Record<string, string> = {
  EXOTEL: "Exotel",
  KNOWLARITY: "Knowlarity",
  MYOPERATOR: "MyOperator",
} as const;

export const TELEPHONY_PROVIDER_COLORS: Record<string, string> = {
  EXOTEL: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  KNOWLARITY: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  MYOPERATOR: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

// ============================================================
// Lead Capture Platform Labels
// ============================================================

export const LEAD_CAPTURE_PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook Lead Ads",
  GOOGLE: "Google Ads",
  INDIAMART: "IndiaMart",
  JUSTDIAL: "JustDial",
  GENERIC: "Generic API",
} as const;

// ============================================================
// Pagination Defaults
// ============================================================

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

// ============================================================
// Loyalty Tier Colors (Phase 10)
// ============================================================

export const LOYALTY_TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  SILVER: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  GOLD: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  PLATINUM: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
} as const;

export const LOYALTY_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  EARNED: "Earned",
  REDEEMED: "Redeemed",
  EXPIRED: "Expired",
  ADJUSTED: "Adjusted",
} as const;

// ============================================================
// Survey Question Type Labels
// ============================================================

export const SURVEY_QUESTION_TYPE_LABELS: Record<string, string> = {
  RATING: "Rating (1-5)",
  TEXT: "Free Text",
  MULTIPLE_CHOICE: "Multiple Choice",
  NPS: "Net Promoter Score (0-10)",
} as const;

// ============================================================
// Review Colors
// ============================================================

export const REVIEW_RATING_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-emerald-500",
} as const;

// ============================================================
// Tasting Status Colors
// ============================================================

export const TASTING_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  NO_SHOW: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
} as const;

// ============================================================
// Media Type Labels
// ============================================================

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  PHOTO: "Photo",
  VIDEO: "Video",
} as const;

// ============================================================
// Phase 11: Analytics, Performance & Competitor Colors
// ============================================================

export const FORECAST_CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  LOW: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

export const COMPETITOR_RATING_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-emerald-500",
} as const;

export const VENDOR_PORTAL_TABS = [
  "Dashboard",
  "Events",
  "Bids",
  "Payouts",
] as const;

// ============================================================
// Phase 12: System Infrastructure
// ============================================================

export const EMERGENCY_TYPE_LABELS: Record<string, string> = {
  FIRE: "Fire",
  MEDICAL: "Medical",
  WEATHER: "Weather",
  SECURITY: "Security",
  POWER_OUTAGE: "Power Outage",
  OTHER: "Other",
} as const;

export const EMERGENCY_SEVERITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  LOW: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
} as const;

export const EMERGENCY_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  RESPONDING: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
} as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  INVOICE: "Invoice",
  PHOTO: "Photo",
  LICENSE: "License",
  PERMIT: "Permit",
  INSURANCE: "Insurance",
  OTHER: "Other",
} as const;

export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "AED", symbol: "\u062F.\u0625", name: "UAE Dirham" },
] as const;

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940" },
  { code: "kn", label: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1" },
  { code: "te", label: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41" },
] as const;

// ============================================================
// Execution Task Status Colors
// ============================================================

export const EXECUTION_TASK_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  BLOCKED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  DELAYED: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
} as const;

// ============================================================
// Event Phase Labels & Colors
// ============================================================

export const EVENT_PHASE_LABELS: Record<string, string> = {
  PRE_EVENT: "Pre-Event",
  SETUP: "Setup",
  GUEST_ARRIVAL: "Guest Arrival",
  LIVE_EVENT: "Live Event",
  WRAP_UP: "Wrap-up",
  HANDOVER: "Handover",
} as const;

export const EVENT_PHASE_COLORS: Record<string, string> = {
  PRE_EVENT: "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  SETUP: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  GUEST_ARRIVAL: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  LIVE_EVENT: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  WRAP_UP: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  HANDOVER: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
} as const;

// ============================================================
// Task Category Labels
// ============================================================

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  DECOR: "D\u00e9cor",
  AV: "Audio/Visual",
  CATERING: "Catering",
  HOUSEKEEPING: "Housekeeping",
  GUEST_SEATING: "Guest Seating",
  ENTERTAINMENT: "Entertainment",
  LOGISTICS: "Logistics",
  SECURITY: "Security",
  GENERAL: "General",
} as const;

// ============================================================
// Escalation Labels & Colors
// ============================================================

export const ESCALATION_LEVEL_LABELS: Record<string, string> = {
  L1_SUPERVISOR: "L1 \u2014 Supervisor",
  L2_MANAGER: "L2 \u2014 Manager",
  L3_LEADERSHIP: "L3 \u2014 Leadership",
} as const;

export const ESCALATION_STATUS_COLORS: Record<string, string> = {
  PENDING_ESCALATION: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  EXPIRED_ESCALATION: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
} as const;

// ============================================================
// Badge Labels
// ============================================================

export const BADGE_TYPE_LABELS: Record<string, string> = {
  SPEED_STAR: "Speed Star",
  QUALITY_CHAMPION: "Quality Champion",
  RELIABILITY_KING: "Reliability King",
  ZERO_ESCALATION: "Zero Escalation",
  TOP_PERFORMER: "Top Performer",
  MONTHLY_BEST: "Monthly Best",
} as const;

// ============================================================
// Referral Labels & Colors
// ============================================================

export const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  GUEST: "Guest",
  PLANNER: "Event Planner",
  VENDOR_REF: "Vendor",
  EMPLOYEE: "Employee",
} as const;

export const REFERRAL_REWARD_STATUS_COLORS: Record<string, string> = {
  REWARD_PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800/40",
  ELIGIBLE: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  REWARD_APPROVED: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  REWARD_PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  REWARD_CANCELLED: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
} as const;

// ============================================================
// INVITATION & REMINDER CONSTANTS
// ============================================================

export const INVITATION_STATUS_COLORS: Record<string, string> = {
  NOT_SENT: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  DELIVERED: "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40",
  OPENED: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40",
  RSVP_ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  RSVP_DECLINED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
} as const;

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  NOT_SENT: "Not Sent",
  SENT: "Invited",
  DELIVERED: "Delivered",
  OPENED: "Opened",
  RSVP_ACCEPTED: "Accepted",
  RSVP_DECLINED: "Declined",
} as const;

export const REMINDER_STAGE_LABELS: Record<string, string> = {
  SAVE_THE_DATE: "Save the Date",
  EXCITEMENT_BUILDER: "Excitement Builder",
  FINAL_COUNTDOWN: "Final Countdown",
  TOMORROW_REMINDER: "Tomorrow Reminder",
  DAY_OF_WELCOME: "Day-Of Welcome",
} as const;

export const REMINDER_STATUS_COLORS: Record<string, string> = {
  REMINDER_PENDING: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  REMINDER_SENT: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  REMINDER_FAILED: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  REMINDER_SKIPPED: "bg-zinc-50 text-zinc-500 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-500 dark:border-zinc-700/40",
} as const;

export const REMINDER_STAGE_DAYS: Record<string, number> = {
  SAVE_THE_DATE: 30,
  EXCITEMENT_BUILDER: 7,
  FINAL_COUNTDOWN: 3,
  TOMORROW_REMINDER: 1,
  DAY_OF_WELCOME: 0,
} as const;
