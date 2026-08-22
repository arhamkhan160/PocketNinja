import React from "react";
import { cn } from "../../lib/cn";

// Wraps the .lm-card helper from index.css so no page hand-writes the shadow.
const Card = ({ className, ...props }) => (
  <div className={cn("lm-card", className)} {...props} />
);

export default Card;
