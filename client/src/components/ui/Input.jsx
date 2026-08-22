import React from "react";
import { cn } from "../../lib/cn";
import { CONTROL_CLASS } from "./controlStyles";

const Input = ({ className, ...props }) => (
  <input className={cn(CONTROL_CLASS, className)} {...props} />
);

export default Input;
