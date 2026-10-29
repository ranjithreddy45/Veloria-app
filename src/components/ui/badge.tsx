import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-[22px] items-center justify-center rounded-full border border-transparent px-2 text-detail font-medium tracking-[-0.005em] tabular-nums w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Soft fills: a badge labels, it does not shout. Solid plum is for buttons.
        default: "bg-primary-soft text-primary [a&]:hover:bg-primary/15",
        secondary:
          "bg-muted text-muted-foreground [a&]:hover:bg-accent",
        destructive:
          "bg-destructive/12 text-destructive [a&]:hover:bg-destructive/20 dark:bg-destructive/20",
        success:
          "bg-success/12 text-success [a&]:hover:bg-success/20 dark:bg-success/20",
        warning:
          "bg-warning/15 text-warning [a&]:hover:bg-warning/25 dark:bg-warning/20",
        outline:
          "border-border bg-card text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
