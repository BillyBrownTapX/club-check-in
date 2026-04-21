import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--color-primary)_52%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--color-primary)_90%,white)]",
        hero: "bg-accent text-accent-foreground shadow-[0_20px_44px_-24px_color-mix(in_oklab,var(--color-ung-gold)_48%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--color-ung-gold-light)_92%,white)]",
        gold: "bg-accent text-accent-foreground shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--color-ung-gold)_42%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--color-ung-gold)_86%,white)]",
        "gold-outline": "border border-accent/50 bg-transparent text-accent hover:bg-accent/12 hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-primary/15 bg-card text-foreground shadow-[0_10px_28px_-20px_color-mix(in_oklab,var(--color-primary)_20%,transparent)] hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground shadow-[0_12px_28px_-22px_color-mix(in_oklab,var(--color-primary)_18%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--color-secondary)_88%,white)]",
        ghost: "text-primary hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
