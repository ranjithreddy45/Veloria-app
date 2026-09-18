// ============================================================
// /event/[token]: what the "What to expect" note and the coordinator's help
// line say, from the booking's real status and the ways of getting in touch
// the page really shows.
//
//  - "Your date is locked in" only for a CONFIRMED or IN_PROGRESS booking. A
//    HOLD or TENTATIVE booking isn't confirmed yet, and a COMPLETED event is over.
//  - No round-the-clock promise: the help line gives the published support hours
//    (Settings → Business contact) when they are set, otherwise "Here to help".
//  - The note points to a way to get in touch only when the page shows one.
//
// Pure, no imports: tested in event-copy.test.ts.
// ============================================================

/** Who the page offers to reach: the coordinator's own number, the business's published channels, or nobody. */
export type HelpRoute = "coordinator" | "team" | null;

export function helpRoute(coordinatorPhone: string | null | undefined, teamReachable: boolean): HelpRoute {
  if (coordinatorPhone?.trim()) return "coordinator";
  return teamReachable ? "team" : null;
}

/** The coordinator's help line: the published support hours when set, never "any time". */
export function helpLine(supportHours: string | null | undefined): string {
  const hours = supportHours?.trim();
  return hours ? `Here to help · Support hours: ${hours}` : "Here to help";
}

export interface NextSteps {
  heading: string;
  body: string;
}

function reachOut(lead: string, route: HelpRoute): string {
  if (route === "coordinator") return ` ${lead}, call your event coordinator below.`;
  if (route === "team") return ` ${lead}, get in touch with our team below.`;
  return "";
}

/** The "What to expect" note for the booking's status. null (it couldn't be read) promises nothing about the date. */
export function nextSteps(status: string | null | undefined, route: HelpRoute): NextSteps {
  switch (status) {
    case "CONFIRMED":
      return {
        heading: "What to expect next",
        body:
          "Your date is locked in and our team is already preparing everything for your big day. " +
          "We'll confirm the final details with you as we get closer." +
          reachOut("If anything changes, or you have a special request", route),
      };
    case "IN_PROGRESS":
      return {
        heading: "What to expect next",
        body:
          "Your date is locked in and our team is looking after everything for your celebration." +
          reachOut("If you need anything", route),
      };
    case "TENTATIVE":
      return {
        heading: "Before your date is confirmed",
        body:
          "Your booking is awaiting confirmation, so your date isn't locked in yet, and the details on this page may still change." +
          reachOut("If you have a question about your booking", route),
      };
    case "HOLD":
      return {
        heading: "Before your date is confirmed",
        body:
          "Your date is on hold, but your booking isn't confirmed yet, and the details on this page may still change." +
          reachOut("If you have a question about your booking", route),
      };
    case "COMPLETED":
      return {
        heading: "Thank you",
        body:
          "Your event has taken place. Thank you for celebrating with us." +
          reachOut("If there's anything we can help with", route),
      };
    case "CANCELLED":
      return {
        heading: "Booking cancelled",
        body: "This booking has been cancelled." + reachOut("If you have a question", route),
      };
    default:
      return {
        heading: "Your event plan",
        body: "Here's your event plan as it stands." + reachOut("If you have a question", route),
      };
  }
}
