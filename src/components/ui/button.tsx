import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// TEK global Button — %100 Tailwind utility + semantic token (hex/inline-style YOK).
// Native buton gorunumu (appearance:auto / 2px outset) `appearance-none` + `border-0`
// tabani ile kesin engellenir; outline/secondary kendi `border` utility'sini ekler.
// TUM butonlar ayni: height(44/36/48) · radius(rounded-lg) · font-weight 600 · gap 8px ·
// ikon 16px · 150ms transition · gorunur ring · disabled davranisi. Sadece variant degisir.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 text-sm font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px active:translate-y-0",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        soft: "bg-muted text-foreground hover:bg-muted/70",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-px active:translate-y-0",
      },
      size: {
        default: "h-11 px-5 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
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
