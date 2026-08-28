import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// TEK global Button — "Strong Gaming SaaS (rafine)" tasarim yonu.
// TUM butonlar ayni: height(44/38/48) · radius(10px) · font-weight 600 · gap 8px ·
// ikon 16px · 150ms transition · gorunur focus ring · disabled davranisi.
// SADECE variant rengi/agirligi degisir. Emphasis (primary/destructive) hover'da
// hafifce yukselir; subtle (secondary/outline/ghost/soft) yuzey tonu degistirir.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-[10px] text-sm font-semibold whitespace-nowrap outline-none transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Ana aksiyon: solid gold + hafif derinlik + taktil kaldirma
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
        // Ikincil: gorunur sinirli dolgu (ghost DEGIL)
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:border-ring/40",
        // Utility: net 1px border + hover soft fill
        outline:
          "border border-border bg-transparent text-foreground hover:border-ring/40 hover:bg-accent hover:text-accent-foreground",
        // Dusuk oncelik: muted metin + soft hover yuzeyi
        ghost:
          "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        // Orta agirlik: muted dolgu, border yok
        soft: "bg-muted text-foreground hover:bg-muted/70",
        // Tehlikeli: modern semantic red, primary ile ayni aile
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
      },
      size: {
        default: "h-11 px-5 has-[>svg]:px-4",
        sm: "h-[38px] gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-[38px]",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
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
