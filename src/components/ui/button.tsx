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
  // Gecis: `transition-all` DEGIL — yalniz degisen ozellikler (renk/border/golge/transform),
  // guclu ozel ease-out (App.css --ease-out ile ayni egri). Press geri bildirimi: hover lift'i
  // iptal et + hafif scale(0.97) ("dinliyor" hissi). Hareket reduced-motion'da notrlenir,
  // renk gecisleri korunur.
  "inline-flex h-[42px] min-h-[42px] shrink-0 cursor-pointer appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-semibold outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.97] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      // SADECE renk + hover davranisi. Fiziksel yapiya (height/padding/radius/border-width/
      // font) DOKUNMAZ. Global hover dili: primary koyulasir · secondary/outline GOLD'a
      // doner · ghost hafif secondary dolgu · destructive koyu kirmizi. hover:bg-accent YOK.
      variant: {
        // primary: Mediterranean Blue -> Deep Blue (koyulasir), acik ivory metin.
        default:
          "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover hover:text-ivory",
        // secondary: Warm Sand yuzey + blue metin. Hover: cok acik blue tint + blue border
        // + deep blue metin (primary kadar baskin degil).
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-tint hover:border-primary hover:text-on-hover",
        // outline: transparent + blue metin. Hover: acik blue tinted yuzey + blue border.
        outline:
          "border-border bg-transparent text-foreground hover:bg-tint hover:border-primary hover:text-on-hover",
        // ghost: transparent + ink metin. Hover: Warm Sand yuzey (blue degil).
        ghost:
          "border-border bg-transparent text-foreground hover:bg-ghost-surface hover:text-foreground",
        // destructive: kirmizi -> koyu kirmizi (terracotta ile karismaz)
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive/90 hover:bg-destructive/90",
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
