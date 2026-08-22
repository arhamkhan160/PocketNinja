import React from "react";
import { cn } from "../../lib/cn";
import { CONTROL_CLASS } from "./controlStyles";

const Select = ({ className, children, ...props }) => (
  <select className={cn(CONTROL_CLASS, className)} {...props}>
    {children}
  </select>
);

export default Select;
