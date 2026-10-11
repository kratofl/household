import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Flat buttons after DESIGN.md: Primär (default), Sekundär, Umrandet (outline),
// Text, Löschen (destructive), plus a borderless ghost for icon actions. Desktop
// sizes S 24px, M 28px, L 32px, XL 36px pill. Buttons never glow: no shadows at all.
// Below lg every button is a pill and at least 44px tall (S/M 44, L 48, XL 56).
// One primary button per view; icon-only buttons need an aria-label.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[background-color,color,filter] select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-2 [&_svg:not([class*='size-'])]:size-4 max-lg:rounded-full",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-on-brand hover:brightness-95 active:brightness-90 disabled:bg-fill disabled:text-label-disabled",
        secondary: "bg-fill text-label hover:bg-fill-strong disabled:text-label-disabled",
        outline: "border border-border bg-surface font-medium text-label hover:bg-fill disabled:bg-fill disabled:text-label-disabled",
        text: "bg-transparent text-link hover:underline disabled:text-label-disabled",
        ghost: "bg-transparent text-label hover:bg-fill aria-expanded:bg-fill disabled:text-label-disabled",
        destructive:
          "bg-red-100 text-red-700 hover:brightness-95 dark:bg-red-500/20 dark:text-danger-text disabled:bg-fill disabled:text-label-disabled",
      },
      size: {
        sm: "h-6 rounded-sm px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3.5 max-lg:min-h-11 max-lg:px-3",
        default: "h-7 rounded-sm px-3 text-[13px] max-lg:min-h-11 max-lg:px-[18px] max-lg:text-[14px]",
        lg: "h-8 rounded-sm px-3.5 text-[13px] max-lg:h-12 max-lg:px-[22px] max-lg:text-[15px]",
        xl: "h-9 rounded-full px-4 text-[14px] max-lg:h-14 max-lg:px-7 max-lg:text-[17px]",
        "icon-sm": "size-6 rounded-sm max-lg:size-11",
        icon: "size-7 rounded-sm max-lg:size-11",
        "icon-lg": "size-8 rounded-sm max-lg:size-12",
      },
    },
    compoundVariants: [{ variant: "text", className: "px-2 max-lg:px-3" }],
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
