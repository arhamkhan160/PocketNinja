import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium " +
    "transition-colors disabled:opacity-60 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[#0D9488] hover:bg-[#0F766E] text-white",
        secondary:
          "border border-[#E7E5E4] bg-white text-[#78716C] hover:text-[#1C1917]",
        danger: "bg-[#FEE2E2] text-[#EF4444] hover:bg-[#fecaca]",
        ghost: "text-[#78716C] hover:bg-[#F5F3F0] hover:text-[#1C1917]",
        dangerGhost: "text-[#78716C] hover:bg-[#FEE2E2] hover:text-[#EF4444]",
      },
      size: {
        sm: "px-3 py-1.5",
        md: "px-4 py-2",
        icon: "p-2",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

const Button = ({ variant, size, className, type = "button", ...props }) => (
  <button
    type={type}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
);

export default Button;
