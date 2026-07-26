import type { FontSize } from "./types";

export const FONT_SIZES = ["standard", "comfortable", "large"] as const satisfies
  readonly FontSize[];

export function normalizeFontSize(value: string | null): FontSize {
  return FONT_SIZES.find((option) => option === value) ?? "standard";
}
