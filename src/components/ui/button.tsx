import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-body font-medium tracking-[-0.01em] transition-press active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Flat plum with a hairline of light on top: the one action colour.
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(109_27_82/0.22),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary-hover dark:shadow-none",
        gradient:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(109_27_82/0.22),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary-hover dark:shadow-none",
        destructive:
          "bg-destructive text-white shadow-[inset_0_1px_0_oklch(1_0_0/15%),0_1px_2px_oklch(0_0_0/10%)] hover:brightness-105 focus-visible:ring-destructive/30",
        // A white sheet on the canvas: hairline edge, the lightest shadow.
        outline:
          "border border-border bg-card text-foreground shadow-[var(--shadow-1)] hover:border-input hover:bg-card dark:hover:bg-accent",
        secondary:
          "bg-muted text-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
