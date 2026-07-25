import type { CfaPattern, PixelValues } from "../types";

const baseMatrices: Record<string, string[][]> = {
  rggb: [["R", "Gr"], ["Gb", "B"]],
  grbg: [["Gr", "R"], ["B", "Gb"]],
  gbrg: [["Gb", "B"], ["R", "Gr"]],
  bggr: [["B", "Gb"], ["Gr", "R"]],
};

function matrixFor(pattern: CfaPattern): string[][] {
  if (pattern === "mono") return [["M"]];
  const quad = pattern.startsWith("quad");
  const key = quad
    ? `${pattern.charAt(4).toLowerCase()}${pattern.slice(5)}`
    : pattern;
  const base = baseMatrices[key];
  if (!quad) return base;
  return base.flatMap((row) => [
    row.flatMap((value) => [value, value]),
    row.flatMap((value) => [value, value]),
  ]);
}

export function CfaPreview({
  pattern,
  values,
  maxValue,
}: {
  pattern: CfaPattern;
  values: PixelValues;
  maxValue: number;
}) {
  const matrix = matrixFor(pattern);
  return (
    <div className="cfa-preview" aria-label={pattern}>
      <div
        className="cfa-grid"
        style={{
          gridTemplateColumns: `repeat(${matrix[0].length}, 1fr)`,
        }}
      >
        {matrix.flatMap((row, rowIndex) =>
          row.map((channel, columnIndex) => {
            const key = channel === "M" ? "mono" : channel.toLowerCase();
            const value = values[key as keyof PixelValues];
            const intensity = Math.max(0.2, value / Math.max(1, maxValue));
            return (
              <div
                className={`cfa-cell channel-${channel.toLowerCase()}`}
                key={`${rowIndex}-${columnIndex}`}
                style={{ "--channel-intensity": intensity } as React.CSSProperties}
              >
                {channel}
              </div>
            );
          }),
        )}
      </div>
      <span className="cfa-origin">0,0</span>
    </div>
  );
}
