export function normalizeUnsignedInteger(value: string): string {
  if (value === "") return "";
  return value.replace(/^0+(?=\d)/, "");
}
