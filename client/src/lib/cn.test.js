import { describe, test, expect } from "vitest";
import { cn } from "./cn";

describe("lib/cn", () => {
  test("joins plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  test("handles conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  test("flattens arrays", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  test("lets a later Tailwind utility beat an earlier conflicting one", () => {
    // The whole reason twMerge is here: a caller's className must win over the
    // component default rather than both landing in the class list.
    expect(cn("px-4", "px-2")).toBe("px-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  test("keeps non-conflicting utilities side by side", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  test("resolves conflicts across argument types", () => {
    expect(cn("p-4", { "p-8": true })).toBe("p-8");
  });

  test("returns an empty string for no arguments", () => {
    expect(cn()).toBe("");
    expect(cn(null, undefined, false)).toBe("");
  });

  test("preserves arbitrary-value classes the app relies on", () => {
    expect(cn("text-[#1C1917]")).toBe("text-[#1C1917]");
    expect(cn("text-[#1C1917]", "text-[#EF4444]")).toBe("text-[#EF4444]");
  });
});
