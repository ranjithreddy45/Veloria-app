import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import AuthSessionProvider from "@/providers/session-provider";
import QueryProvider from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { CapacitorProvider } from "@/providers/capacitor-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import "./globals.css";

// ============================================================
// Typography — a deliberate, brand-owned type system.
// ------------------------------------------------------------
// Previously the stack led with -apple-system, so the whole app rendered in the
// raw OS font (SF Pro on Mac, Inter elsewhere): consistent-looking to a browser,
// but it reads as *unstyled* and differs per platform. We now ship real webfonts
// so Veloria looks identical and intentional everywhere:
//   Geist       — UI / body. Modern premium grotesque, superb at small sizes.
//   Geist Mono  — numerals, money, IDs. (globals.css already referenced
//                 --font-geist-mono, which was never defined → every tabular
//                 figure silently fell back to Courier. This wires it for real.)
//   Fraunces    — editorial serif reserved for large display moments (page
//                 titles, hero, portal). Gives a luxury-hospitality voice
//                 without hurting data density.
// All are variable + self-hosted by next/font (no layout shift, no external CDN).
// ============================================================
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Veloria Grand",
    template: "%s | Veloria Grand",
  },
  description: "Premium Event Venue Management",
  keywords: [
    "venue management",
    "event management",
    "booking system",
    "CRM",
    "invoice management",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veloria Grand",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthSessionProvider>
            <QueryProvider>
              <CapacitorProvider>
                <TooltipProvider delayDuration={0}>
                  {/* Registers /sw.js in production (browser only) so Android/Chrome
                      offers "Install app" — see components/pwa/service-worker-registrar. */}
                  <ServiceWorkerRegistrar />
                  {children}
                  <Toaster position="top-right" richColors closeButton />
                </TooltipProvider>
              </CapacitorProvider>
            </QueryProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
