export const COMPACT_VIEWPORT_WIDTH = 860;
export const COMPACT_VIEWPORT_HEIGHT = 600;

export function calculateViewportScale(width: number, height: number): number {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      width / COMPACT_VIEWPORT_WIDTH,
      height / COMPACT_VIEWPORT_HEIGHT,
    ),
  );
}
