// ============================================================
// Mobile tab-row class preset.
// ------------------------------------------------------------
// A phone is 375px wide. Any TabsList with more than about three labels
// ("Overview / Details / Team / Documents / Compensation / Payslips /
// Statutory" is seven) is wider than that, and the default TabsList is
// `inline-flex w-fit` with no scroller — so the extra tabs spill past the
// viewport and drag the whole page sideways. A sideways-scrolling page is the
// single worst mobile failure, so the row has to become its own scroller.
//
// Three things have to happen together, which is why this is one constant
// rather than three classes remembered per call site:
//
//  1. `overflow-x-auto` + `snap-x` turns the row into a deliberate, snapping
//     horizontal scroller instead of an accidental page-wide overflow.
//
//  2. Triggers must be `shrink-0`. TabsTrigger is `flex-1` by default, which
//     inside a scroller squashes every tab into the visible width instead of
//     overflowing it — the labels would truncate rather than scroll. Applied
//     as a descendant rule so call sites only touch the list.
//
//  3. The height must be released. TabsList pins itself to `h-9` (36px) via
//     `group-data-[orientation=horizontal]/tabs:h-9`, while globals.css raises
//     every `[data-slot="tabs-trigger"]` to a 44px minimum on touch devices.
//     A 44px trigger inside a 36px scroll box makes the box scroll vertically
//     too (CSS forces overflow-y to `auto` once overflow-x is not `visible`),
//     clipping the labels. `h-auto` at the same variant lets tailwind-merge
//     strip the h-9; `min-h-9` keeps the desktop appearance identical.
//
// Desktop is unaffected: at desktop widths these rows fit, so nothing scrolls,
// and the pointer:coarse rule that forces the taller triggers never applies to
// a mouse.
// ============================================================

/**
 * Apply to any <TabsList> whose labels can exceed 375px.
 *
 * Deliberately `max-w-full` and NOT `w-full`: TabsList is `inline-flex w-fit`,
 * so on a desktop the pill group hugs its labels. Forcing w-full would stretch
 * that background across the whole content column — a visible desktop
 * regression. max-w-full only clamps the row once it would overflow, which is
 * exactly the phone case.
 */
export const TAB_LIST_SCROLL =
  "max-w-full justify-start overflow-x-auto snap-x scroll-px-1 " +
  "group-data-[orientation=horizontal]/tabs:h-auto min-h-9 " +
  "[&>[data-slot=tabs-trigger]]:shrink-0 [&>[data-slot=tabs-trigger]]:snap-start";
