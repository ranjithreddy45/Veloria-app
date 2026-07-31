"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-card/80 backdrop-blur-xl backdrop-saturate-150 data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col shadow-card-hover transition ease-[cubic-bezier(0.4,0,0.2,1)] data-[state=closed]:duration-300 data-[state=open]:duration-500",
          // Side sheets: 3/4 of a 375px phone is 281px, which is genuinely
          // cramped for the forms and detail panels these hold. Go to 88% on a
          // phone (the 12% strip left over is also the tap-to-dismiss target,
          // so full-bleed would be worse) and cap it, then hand back to the
          // original 3/4 + max-w-sm from `sm` up so tablets/desktop are
          // untouched. The pb- inset keeps a footer button clear of the iOS
          // home indicator once the app is installed as a PWA (--sab is 0px in
          // a browser).
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-[88%] max-w-[24rem] pb-[max(var(--sab),0px)] border-l border-border/60 rounded-l-2xl sm:w-3/4 sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-[88%] max-w-[24rem] pb-[max(var(--sab),0px)] border-r border-border/60 rounded-r-2xl sm:w-3/4 sm:max-w-sm",
          // Top/bottom sheets had no height ceiling: tall content ran straight
          // off the screen with nothing to scroll. Cap at 85dvh (dvh, not vh,
          // so the mobile URL bar collapsing doesn't clip the last row).
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto max-h-[85dvh] pt-[max(var(--sat),0px)] border-b border-border/60 rounded-b-2xl",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto max-h-[85dvh] pb-[max(var(--sab),0px)] border-t border-border/60 rounded-t-2xl",
          className
        )}
        {...props}
      >
        {/* The scroll lives on this inner wrapper, not on SheetContent itself.
            A tall sheet on a 375x812 phone previously ran off the bottom of the
            screen with no way to reach the last field. Keeping the scroller
            inside means the close button below stays a DIRECT child of
            SheetContent — so it remains pinned to the panel instead of
            scrolling away, and callers' `[&>button]:hidden` selectors (the
            mobile sidebar uses one) still match. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
          {children}
        </div>
        {showCloseButton && (
          <SheetPrimitive.Close className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px] data-[state=open]:bg-accent absolute top-4 right-4 flex size-8 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-100 active:scale-[0.97] focus-visible:outline-none disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-5", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold tracking-[-0.02em]", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
