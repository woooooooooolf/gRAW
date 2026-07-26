import type {
  CfaPattern,
  LocalLayout,
  RawConfig,
  StorageFormat,
  TestPattern,
} from "./types";

export const DEFAULT_CONFIG: RawConfig = {
  width: 1920,
  height: 1080,
  bitDepth: 10,
  storageFormat: "mipi10",
  endianness: "little",
  bitAlignment: "lsb",
  cfaPattern: "rggb",
  testPattern: "fixed",
  pixelValues: {
    mono: 512,
    r: 1023,
    gr: 512,
    gb: 512,
    b: 128,
  },
  graySteps: 16,
  checkerSize: 64,
  noiseSeed: 20260725,
  rowAlignment: 1,
  frameAlignment: 1,
  fileOffset: 0,
  offsetFill: 0,
  rowPaddingFill: 0,
  framePaddingFill: 0,
  frameCount: 1,
};

export const BIT_DEPTHS = Array.from({ length: 9 }, (_, index) => index + 8);

export const TEST_PATTERNS: readonly TestPattern[] = [
  "fixed",
  "horizontalGradient",
  "verticalGradient",
  "graySteps",
  "colorBars",
  "checkerboard",
  "randomNoise",
  "black",
  "white",
];

const MONO_TEST_PATTERNS = TEST_PATTERNS.filter(
  (pattern) => pattern !== "colorBars",
);

export function testPatternsFor(
  cfaPattern: CfaPattern,
): readonly TestPattern[] {
  return cfaPattern === "mono" ? MONO_TEST_PATTERNS : TEST_PATTERNS;
}

export function withCfaPattern(
  config: RawConfig,
  cfaPattern: CfaPattern,
): RawConfig {
  const supportedPatterns = testPatternsFor(cfaPattern);
  return {
    ...config,
    cfaPattern,
    testPattern: supportedPatterns.includes(config.testPattern)
      ? config.testPattern
      : "graySteps",
  };
}

export function bitDepthsFor(format: StorageFormat): number[] {
  switch (format) {
    case "unpacked8":
      return [8];
    case "unpacked16":
      return BIT_DEPTHS;
    case "mipi10":
      return [10];
    case "mipi12":
      return [12];
    case "mipi14":
      return [14];
  }
}

export function withStorageFormat(
  config: RawConfig,
  storageFormat: StorageFormat,
): RawConfig {
  const bitDepth = bitDepthsFor(storageFormat).includes(config.bitDepth)
    ? config.bitDepth
    : bitDepthsFor(storageFormat)[0];
  return clampPixelValues({ ...config, storageFormat, bitDepth });
}

export function withBitDepth(config: RawConfig, bitDepth: number): RawConfig {
  return clampPixelValues({ ...config, bitDepth });
}

export function maxValue(bitDepth: number): number {
  return bitDepth === 16 ? 65535 : 2 ** bitDepth - 1;
}

export function clampPixelValues(config: RawConfig): RawConfig {
  const maximum = maxValue(config.bitDepth);
  const clamp = (value: number) =>
    Math.min(maximum, Math.max(0, Math.trunc(value)));
  return {
    ...config,
    pixelValues: {
      mono: clamp(config.pixelValues.mono),
      r: clamp(config.pixelValues.r),
      gr: clamp(config.pixelValues.gr),
      gb: clamp(config.pixelValues.gb),
      b: clamp(config.pixelValues.b),
    },
  };
}

export function calculateLayout(config: RawConfig): LocalLayout {
  const width = BigInt(config.width);
  const rowPayload = (() => {
    switch (config.storageFormat) {
      case "unpacked8":
        return width;
      case "unpacked16":
        return width * 2n;
      case "mipi10":
        return (width / 4n) * 5n;
      case "mipi12":
        return (width / 2n) * 3n;
      case "mipi14":
        return (width / 4n) * 7n;
    }
  })();
  const rowStride = alignUp(rowPayload, BigInt(config.rowAlignment));
  const frameData = rowStride * BigInt(config.height);
  const frameStride = alignUp(frameData, BigInt(config.frameAlignment));
  return {
    maxValue: maxValue(config.bitDepth),
    rowPayload,
    rowStride,
    rowPadding: rowStride - rowPayload,
    frameData,
    frameStride,
    framePadding: frameStride - frameData,
    totalSize:
      BigInt(config.fileOffset) + frameStride * BigInt(config.frameCount),
  };
}

export function validateConfig(config: RawConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  integerRange(errors, "width", config.width, 1, 1_000_000);
  integerRange(errors, "height", config.height, 1, 1_000_000);
  integerRange(errors, "frameCount", config.frameCount, 1, 1_000_000);
  integerRange(errors, "rowAlignment", config.rowAlignment, 1, 1_048_576);
  integerRange(errors, "frameAlignment", config.frameAlignment, 1, 1_073_741_824);
  integerRange(errors, "fileOffset", config.fileOffset, 0, Number.MAX_SAFE_INTEGER);

  if (!bitDepthsFor(config.storageFormat).includes(config.bitDepth)) {
    errors.bitDepth = "invalidDepth";
  }
  if (
    (config.storageFormat === "mipi10" ||
      config.storageFormat === "mipi14") &&
    config.width % 4 !== 0
  ) {
    errors.width = "widthMultiple4";
  }
  if (config.storageFormat === "mipi12" && config.width % 2 !== 0) {
    errors.width = "widthMultiple2";
  }
  if (!testPatternsFor(config.cfaPattern).includes(config.testPattern)) {
    errors.testPattern = "patternCfaMismatch";
  }
  if (
    config.testPattern === "graySteps" &&
    (!Number.isInteger(config.graySteps) ||
      config.graySteps < 2 ||
      config.graySteps > 256)
  ) {
    errors.graySteps = "stepsRange";
  }
  if (
    config.testPattern === "checkerboard" &&
    (!Number.isInteger(config.checkerSize) || config.checkerSize < 1)
  ) {
    errors.checkerSize = "positiveInteger";
  }

  const maximum = maxValue(config.bitDepth);
  Object.entries(config.pixelValues).forEach(([key, value]) => {
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
      errors[`pixelValues.${key}`] = "pixelRange";
    }
  });
  for (const [key, value] of [
    ["offsetFill", config.offsetFill],
    ["rowPaddingFill", config.rowPaddingFill],
    ["framePaddingFill", config.framePaddingFill],
  ] as const) {
    integerRange(errors, key, value, 0, 255);
  }

  if (Object.keys(errors).length === 0) {
    try {
      const layout = calculateLayout(config);
      if (layout.totalSize > 18_446_744_073_709_551_615n) {
        errors.totalSize = "sizeOverflow";
      }
    } catch {
      errors.totalSize = "sizeOverflow";
    }
  }
  return errors;
}

function integerRange(
  errors: Record<string, string>,
  key: string,
  value: number,
  minimum: number,
  maximum: number,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    errors[key] = minimum === 0 ? "nonNegativeInteger" : "positiveInteger";
  }
}

function alignUp(value: bigint, alignment: bigint): bigint {
  if (alignment <= 0n) return value;
  const remainder = value % alignment;
  return remainder === 0n ? value : value + alignment - remainder;
}

export function formatBytes(bytes: bigint | number, locale = "zh-CN"): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let scaled = value;
  let index = 0;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  const digits = index === 0 ? 0 : scaled >= 100 ? 1 : 2;
  return `${scaled.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} ${units[index]}`;
}

export function formatInteger(value: bigint | number, locale = "zh-CN") {
  return value.toLocaleString(locale);
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const totalSeconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function hexByte(value: number): string {
  return `0x${Math.max(0, Math.min(255, value))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
}
