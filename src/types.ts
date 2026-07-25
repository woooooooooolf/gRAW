export type StorageFormat =
  | "unpacked8"
  | "unpacked16"
  | "mipi10"
  | "mipi12"
  | "mipi14";

export type Endianness = "little" | "big";
export type BitAlignment = "lsb" | "msb";
export type CfaPattern =
  | "mono"
  | "rggb"
  | "grbg"
  | "gbrg"
  | "bggr"
  | "quadRggb"
  | "quadGrbg"
  | "quadGbrg"
  | "quadBggr";
export type TestPattern =
  | "fixed"
  | "horizontalGradient"
  | "verticalGradient"
  | "graySteps"
  | "colorBars"
  | "checkerboard"
  | "randomNoise"
  | "black"
  | "white";

export interface PixelValues {
  mono: number;
  r: number;
  gr: number;
  gb: number;
  b: number;
}

export interface RawConfig {
  width: number;
  height: number;
  bitDepth: number;
  storageFormat: StorageFormat;
  endianness: Endianness;
  bitAlignment: BitAlignment;
  cfaPattern: CfaPattern;
  testPattern: TestPattern;
  pixelValues: PixelValues;
  graySteps: number;
  checkerSize: number;
  noiseSeed: number;
  rowAlignment: number;
  frameAlignment: number;
  fileOffset: number;
  offsetFill: number;
  rowPaddingFill: number;
  framePaddingFill: number;
  frameCount: number;
}

export interface FrameLayout {
  maxValue: number;
  rowPayload: number;
  rowStride: number;
  rowPadding: number;
  frameData: number;
  frameStride: number;
  framePadding: number;
  totalSize: number;
}

export interface LocalLayout {
  maxValue: number;
  rowPayload: bigint;
  rowStride: bigint;
  rowPadding: bigint;
  frameData: bigint;
  frameStride: bigint;
  framePadding: bigint;
  totalSize: bigint;
}

export interface GenerationProgress {
  stage: "preparing" | "offset" | "pixels" | "framePadding" | "finalizing";
  bytesWritten: number;
  totalBytes: number;
  currentFrame: number;
  frameCount: number;
  elapsedMs: number;
}

export interface GenerationResult {
  outputPath: string;
  totalBytes: number;
  elapsedMs: number;
}

export type Language = "zh-CN" | "en-US";
export type ThemeId =
  | "deep-sea"
  | "obsidian-violet"
  | "deep-space"
  | "glacier"
  | "mist-violet"
  | "clear-sky";
export type FontSize = "small" | "standard" | "large";
