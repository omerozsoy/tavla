import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// TEK global Button — GLOBAL FIZIKSEL STANDART.
// TUM butonlar FIZIKSEL olarak AYNI: height 42px · radius 8px (rounded-md) · 1px solid
// border (ghost dahil) · font 14px/600 · px-4 · gap 8px · ikon 16px. Variant SADECE
// renk (bg/text/border/hover) degistirir — height/padding/radius/border-width/font ASLA.
// Native buton gorunumu `appearance-none` + shadcn.css'teki [data-slot] reset (border:0
// solid -> border-style solid) ile engellenir; base `border` = 1px, variant = border-color.
const buttonVariants = cva(
  "inline-flex h-[42px] min-h-[42px] shrink-0 cursor-pointer appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      // SADECE renk. Fiziksel yapiya (height/padding/radius/border-width/font) DOKUNMAZ.
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      // sm/lg YOK — tum normal aksiyonlar tek boyut. icon = 42x42 (yatay padding'siz kare).
      size: {
        default: "",
        icon: "w-[42px] px-0",
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
