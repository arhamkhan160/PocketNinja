import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge conditional classes and let a caller's class beat the component
// default (twMerge drops the loser when two Tailwind utilities collide).
export const cn = (...inputs) => twMerge(clsx(inputs));
