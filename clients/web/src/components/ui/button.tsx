import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// macOS-style push buttons: small, rounded rectangles, subtle vertical gradient.
// The gradient and hairline live in globals.css (.push / .push-default).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-[background,filter,color] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "push push-default",
        outline: "push",
        secondary: "push",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive: "push text-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-5 gap-1 rounded-[5px] px-1.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-8 px-3",
        icon: "size-7",
        "icon-xs": "size-5 rounded-[5px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-8",
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
