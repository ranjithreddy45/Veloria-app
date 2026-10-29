"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "relative rounded-[11px] p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:rounded-2xl",
  {
    variants: {
      variant: {
        default: "border border-border bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// One highlight that glides to the active tab, instead of each tab switching
// its own background on and off. It is measured from the active trigger, so
// it follows wrapped, scrolled and resized lists. Until it has been placed
// (and wherever it can't be, e.g. a vertical line list) the triggers keep
// their own active styling, so nothing ever renders without a highlight.
function useTabsIndicator(
  listRef: React.RefObject<HTMLDivElement | null>,
  indicatorRef: React.RefObject<HTMLSpanElement | null>,
  variant: string
) {
  React.useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    const vertical =
      list.closest("[data-slot=tabs]")?.getAttribute("data-orientation") === "vertical"
    if (variant === "line" && vertical) return

    const place = () => {
      const active = Array.from(
        list.querySelectorAll<HTMLElement>("[data-slot=tabs-trigger][data-state=active]")
      ).find((t) => t.closest("[data-slot=tabs-list]") === list)
      const lr = list.getBoundingClientRect()
      if (!active || lr.width === 0) {
        delete list.dataset.indicator
        return
      }
      const r = active.getBoundingClientRect()
      const x = r.left - lr.left + list.scrollLeft - list.clientLeft
      const y = r.top - lr.top + list.scrollTop - list.clientTop
      indicator.style.width = `${r.width}px`
      if (variant === "line") {
        // Where the trigger's own underline sat: 5px below, 2px tall.
        indicator.style.height = "2px"
        indicator.style.transform = `translate(${x}px, ${y + r.height + 3}px)`
      } else {
        indicator.style.height = `${r.height}px`
        indicator.style.transform = `translate(${x}px, ${y}px)`
      }
      list.dataset.indicator = ""
    }

    place()
    // The first placement lands without travelling; only later moves glide.
    const settle = window.setTimeout(() => {
      indicator.dataset.ready = ""
    }, 50)
    const mo = new MutationObserver(place)
    // Tabs added or removed later move the active one without resizing the list.
    mo.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] })
    const ro = new ResizeObserver(place)
    ro.observe(list)
    for (const child of Array.from(list.children)) ro.observe(child)
    return () => {
      window.clearTimeout(settle)
      mo.disconnect()
      ro.disconnect()
    }
  }, [listRef, indicatorRef, variant])
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const indicatorRef = React.useRef<HTMLSpanElement>(null)
  useTabsIndicator(listRef, indicatorRef, variant ?? "default")
  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        data-slot="tabs-indicator"
        className={cn(
          "pointer-events-none absolute top-0 left-0 hidden group-data-[indicator]/tabs-list:block",
          "data-[ready]:transition-[transform,width,height] data-[ready]:duration-(--motion-slow) data-[ready]:ease-(--motion-spring)",
          variant === "line"
            ? "bg-primary rounded-full"
            : "bg-card shadow-[var(--shadow-1),inset_0_0_0_1px_var(--border)] rounded-[8px] group-data-[orientation=vertical]/tabs:rounded-xl dark:bg-accent"
        )}
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-transparent px-3 py-1 text-body font-medium tracking-[-0.01em] whitespace-nowrap transition-premium active:scale-[0.97] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[orientation=vertical]/tabs:rounded-xl focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-card group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:rounded-md group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-card dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/40 data-[state=active]:text-foreground",
        "group-data-[indicator]/tabs-list:data-[state=active]:bg-transparent group-data-[indicator]/tabs-list:data-[state=active]:shadow-none dark:group-data-[indicator]/tabs-list:data-[state=active]:border-transparent dark:group-data-[indicator]/tabs-list:data-[state=active]:bg-transparent group-data-[indicator]/tabs-list:after:hidden",
        "after:bg-primary after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
