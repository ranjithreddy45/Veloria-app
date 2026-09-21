// The finished home screen, as plain serialisable data (no Dates, no
// Decimals), so it can cross from the server action to any component.

import type { HomeLens } from "./lens";
import type { AttentionItem } from "./attention";
import type { Greeting, HomeKpi, SideCard } from "./summary";

export interface HomeView {
  lens: HomeLens;
  lensLabel: string;
  greeting: Greeting;
  kpis: HomeKpi[];
  attention: AttentionItem[];
  side: SideCard | null;
  /** One or more blocks failed to load and were left out rather than guessed. */
  degraded: boolean;
  /** When this view was read, ISO. */
  asOf: string;
}
