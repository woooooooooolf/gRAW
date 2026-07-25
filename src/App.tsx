import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  bitDepthsFor,
  calculateLayout,
  DEFAULT_CONFIG,
  formatBytes,
  formatDuration,
  formatInteger,
  hexByte,
  maxValue,
  validateConfig,
  withBitDepth,
  withStorageFormat,
} from "./config";
import { createTranslator } from "./i18n";
import type {
  CfaPattern,
  Endianness,
  FrameLayout,
  GenerationProgress,
  GenerationResult,
  Language,
  Palette,
  RawConfig,
  StorageFormat,
  TestPattern,
  ThemeMode,
} from "./types";
import { AboutDialog } from "./components/AboutDialog";
import { BrandIcon } from "./components/BrandIcon";
import { CfaPreview } from "./components/CfaPreview";
import { NumberField, SelectField } from "./components/FormControls";
import { LayoutSummary } from "./components/LayoutSummary";
import "./App.css";

const storageFormats: StorageFormat[] = [
  "unpacked8",
  "unpacked16",
  "mipi10",
  "mipi12",
  "mipi14",
];
const cfaPatterns: CfaPattern[] = [
  "mono",
  "rggb",
  "grbg",
  "gbrg",
  "bggr",
  "quadRggb",
  "quadGrbg",
  "quadGbrg",
  "quadBggr",
];
const testPatterns: TestPattern[] = [
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

type RunState = "idle" | "generating" | "completed" | "cancelled" | "failed";

function App() {
  const [config, setConfig] = useState<RawConfig>(DEFAULT_CONFIG);
  const [language, setLanguage] = useStoredState<Language>("graw-language", "zh-CN");
  const [theme, setTheme] = useStoredState<ThemeMode>("graw-theme", "system");
  const [palette, setPalette] = useStoredState<Palette>("graw-palette", "cyan");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const t = useMemo(() => createTranslator(language), [language]);
  const errors = useMemo(() => validateConfig(config), [config]);
  const valid = Object.keys(errors).length === 0;
  const layout = useMemo(
    () => (valid ? calculateLayout(config) : null),
    [config, valid],
  );
  const maximum = maxValue(config.bitDepth);
  const busy = runState === "generating";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
    document.title = `gRAW · ${t("app.subtitle")}`;
  }, [language, theme, palette, t]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<GenerationProgress>("generation-progress", (event) => {
      setProgress(event.payload);
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, []);

  function update<K extends keyof RawConfig>(key: K, value: RawConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    if (runState !== "generating") setRunState("idle");
    setRuntimeError("");
    setResult(null);
  }

  function updatePixel(key: keyof RawConfig["pixelValues"], value: number) {
    setConfig((current) => ({
      ...current,
      pixelValues: { ...current.pixelValues, [key]: value },
    }));
    setRunState("idle");
    setResult(null);
  }

  async function generate() {
    if (!valid || busy) return;
    setRuntimeError("");
    setResult(null);
    try {
      await invoke<FrameLayout>("calculate_layout", { config });
      let outputPath = await save({
        title: t("dialog.saveTitle"),
        defaultPath: defaultFileName(config),
        filters: [{ name: t("dialog.rawFiles"), extensions: ["raw"] }],
      });
      if (!outputPath) return;
      if (!outputPath.toLowerCase().endsWith(".raw")) outputPath += ".raw";

      setProgress({
        stage: "preparing",
        bytesWritten: 0,
        totalBytes: Number(layout?.totalSize ?? 0n),
        currentFrame: 0,
        frameCount: config.frameCount,
        elapsedMs: 0,
      });
      setRunState("generating");
      const generated = await invoke<GenerationResult>("generate_raw", {
        request: { outputPath, config },
      });
      setResult(generated);
      setRunState("completed");
    } catch (error) {
      const message = String(error);
      if (message.includes("已取消生成")) {
        setRunState("cancelled");
      } else {
        setRuntimeError(message);
        setRunState("failed");
      }
    }
  }

  async function cancel() {
    await invoke("cancel_generation");
  }

  const firstError = Object.values(errors)[0];
  const statusText =
    runState === "generating"
      ? t("status.generating")
      : runState === "completed"
        ? t("status.completed")
        : runState === "cancelled"
          ? t("status.cancelled")
          : runState === "failed"
            ? t("status.failed")
            : valid
              ? t("status.ready")
              : t("status.invalid");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandIcon />
          <div>
            <div className="brand-title">
              <strong>{t("app.name")}</strong>
              <span>V0.0.1</span>
            </div>
            <p>{t("app.tagline")}</p>
          </div>
        </div>
        <div className="toolbar">
          <ToolbarSelect
            label={t("header.language")}
            value={language}
            onChange={(value) => setLanguage(value as Language)}
            options={[
              ["zh-CN", "中文"],
              ["en-US", "English"],
            ]}
          />
          <ToolbarSelect
            label={t("header.appearance")}
            value={theme}
            onChange={(value) => setTheme(value as ThemeMode)}
            options={(["system", "dark", "light"] as ThemeMode[]).map((value) => [
              value,
              t(`theme.${value}`),
            ])}
          />
          <ToolbarSelect
            label={t("header.palette")}
            value={palette}
            onChange={(value) => setPalette(value as Palette)}
            options={(["cyan", "violet", "blue"] as Palette[]).map((value) => [
              value,
              t(`palette.${value}`),
            ])}
          />
          <button className="about-button" onClick={() => setAboutOpen(true)}>
            <span>i</span>{t("header.about")}
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="workspace-grid">
          <Card title={t("section.image")} hint={t("section.imageHint")} className="image-card">
            <div className="card-split">
              <div className="form-grid compact">
                <NumberField
                  id="width"
                  label={t("field.width")}
                  value={config.width}
                  onChange={(value) => update("width", value)}
                  errorCode={errors.width}
                  t={t}
                  min={1}
                  suffix="px"
                />
                <NumberField
                  id="height"
                  label={t("field.height")}
                  value={config.height}
                  onChange={(value) => update("height", value)}
                  errorCode={errors.height}
                  t={t}
                  min={1}
                  suffix="px"
                />
                <SelectField
                  id="cfa"
                  label={t("field.cfa")}
                  value={config.cfaPattern}
                  onChange={(value) => update("cfaPattern", value as CfaPattern)}
                  options={cfaPatterns.map((value) => ({
                    value,
                    label: cfaLabel(value),
                  }))}
                  className="span-2"
                />
              </div>
              <CfaPreview
                pattern={config.cfaPattern}
                values={config.pixelValues}
                maxValue={maximum}
              />
            </div>
          </Card>

          <Card title={t("section.pattern")} hint={t("section.patternHint")} className="pattern-card">
            <div className={`pattern-banner pattern-${config.testPattern}`}>
              <span>{t(`pattern.${config.testPattern}`)}</span>
            </div>
            <SelectField
              id="pattern"
              label={t("field.pattern")}
              value={config.testPattern}
              onChange={(value) => update("testPattern", value as TestPattern)}
              options={testPatterns.map((value) => ({
                value,
                label: t(`pattern.${value}`),
              }))}
            />
            {config.testPattern === "fixed" && (
              <div className="channel-grid">
                {(config.cfaPattern === "mono"
                  ? (["mono"] as const)
                  : (["r", "gr", "gb", "b"] as const)
                ).map((channel) => (
                  <NumberField
                    key={channel}
                    id={`pixel-${channel}`}
                    label={t(`field.${channel}`)}
                    value={config.pixelValues[channel]}
                    onChange={(value) => updatePixel(channel, value)}
                    errorCode={errors[`pixelValues.${channel}`]}
                    t={t}
                    min={0}
                    max={maximum}
                    suffix={`/ ${maximum}`}
                  />
                ))}
              </div>
            )}
            {config.testPattern === "graySteps" && (
              <NumberField
                id="gray-steps"
                label={t("field.graySteps")}
                value={config.graySteps}
                onChange={(value) => update("graySteps", value)}
                errorCode={errors.graySteps}
                t={t}
                min={2}
                max={256}
              />
            )}
            {config.testPattern === "checkerboard" && (
              <NumberField
                id="checker-size"
                label={t("field.checkerSize")}
                value={config.checkerSize}
                onChange={(value) => update("checkerSize", value)}
                errorCode={errors.checkerSize}
                t={t}
                min={1}
                suffix="px"
              />
            )}
            {config.testPattern === "randomNoise" && (
              <NumberField
                id="noise-seed"
                label={t("field.noiseSeed")}
                value={config.noiseSeed}
                onChange={(value) => update("noiseSeed", value)}
                t={t}
                min={0}
              />
            )}
          </Card>

          <Card title={t("section.storage")} hint={t("section.storageHint")}>
            <div className="form-grid compact">
              <SelectField
                id="storage"
                label={t("field.storage")}
                value={config.storageFormat}
                onChange={(value) =>
                  setConfig((current) =>
                    withStorageFormat(current, value as StorageFormat),
                  )
                }
                options={storageFormats.map((value) => ({
                  value,
                  label: storageLabel(value),
                }))}
              />
              <SelectField
                id="bit-depth"
                label={t("field.bitDepth")}
                value={config.bitDepth}
                onChange={(value) =>
                  setConfig((current) => withBitDepth(current, Number(value)))
                }
                options={bitDepthsFor(config.storageFormat).map((value) => ({
                  value,
                  label: `${value} bit`,
                }))}
                disabled={config.storageFormat !== "unpacked16"}
              />
            </div>
            <div className="format-note">
              <span className="status-orb" />
              {t(
                config.storageFormat.startsWith("mipi")
                  ? "note.mipiLayout"
                  : config.storageFormat === "unpacked8"
                    ? "note.unpacked8"
                    : "note.unpacked16",
              )}
            </div>
          </Card>

          <Card title={t("section.file")} hint={t("section.fileHint")}>
            <div className="form-grid compact">
              <NumberField id="frames" label={t("field.frameCount")} value={config.frameCount}
                onChange={(value) => update("frameCount", value)} errorCode={errors.frameCount}
                t={t} min={1} />
              <NumberField id="offset" label={t("field.fileOffset")} value={config.fileOffset}
                onChange={(value) => update("fileOffset", value)} errorCode={errors.fileOffset}
                t={t} min={0} suffix="B" />
              <NumberField id="row-align" label={t("field.rowAlignment")} value={config.rowAlignment}
                onChange={(value) => update("rowAlignment", value)} errorCode={errors.rowAlignment}
                t={t} min={1} suffix="B" />
              <NumberField id="frame-align" label={t("field.frameAlignment")} value={config.frameAlignment}
                onChange={(value) => update("frameAlignment", value)} errorCode={errors.frameAlignment}
                t={t} min={1} suffix="B" />
            </div>
          </Card>

          <Card title={t("section.advanced")} hint={t("section.advancedHint")} className="advanced-card">
            <div className="advanced-grid">
              <SelectField id="endian" label={t("field.endian")} value={config.endianness}
                onChange={(value) => update("endianness", value as Endianness)}
                options={[{ value: "little", label: t("endian.little") }, { value: "big", label: t("endian.big") }]}
                disabled={config.storageFormat !== "unpacked16"}
                hint={config.storageFormat.startsWith("mipi") ? t("note.mipiLayout") : undefined} />
              <SelectField id="bit-align" label={t("field.bitAlignment")} value={config.bitAlignment}
                onChange={(value) => update("bitAlignment", value as "lsb" | "msb")}
                options={[{ value: "lsb", label: t("align.lsb") }, { value: "msb", label: t("align.msb") }]}
                disabled={config.storageFormat !== "unpacked16" || config.bitDepth === 16} />
              <FillField id="offset-fill" label={t("field.offsetFill")} value={config.offsetFill}
                onChange={(value) => update("offsetFill", value)} error={errors.offsetFill} t={t} />
              <FillField id="row-fill" label={t("field.rowFill")} value={config.rowPaddingFill}
                onChange={(value) => update("rowPaddingFill", value)} error={errors.rowPaddingFill} t={t} />
              <FillField id="frame-fill" label={t("field.frameFill")} value={config.framePaddingFill}
                onChange={(value) => update("framePaddingFill", value)} error={errors.framePaddingFill} t={t} />
            </div>
          </Card>

          <Card title={t("section.summary")} hint={t("section.summaryHint")} className="summary-card">
            <LayoutSummary config={config} layout={layout} t={t} locale={language} />
          </Card>
        </div>
      </main>

      <footer className={`statusbar state-${runState}`}>
        <div className="status-copy">
          <span className={`status-orb ${!valid || runState === "failed" ? "error" : ""}`} />
          <div>
            <strong>{statusText}</strong>
            <small>
              {runtimeError ||
                (firstError ? t(`error.${firstError}`) : progressDetail(progress, t, language))}
            </small>
          </div>
        </div>
        {busy && progress && <Progress progress={progress} t={t} locale={language} />}
        <div className="status-actions">
          {result && runState === "completed" && (
            <button className="secondary-button" onClick={() => revealItemInDir(result.outputPath)}>
              {t("action.reveal")}
            </button>
          )}
          {busy ? (
            <button className="cancel-button" onClick={cancel}>{t("action.cancel")}</button>
          ) : (
            <button className="generate-button" disabled={!valid} onClick={generate}>
              <span className="generate-icon">◇</span>{t("action.generate")}
            </button>
          )}
        </div>
      </footer>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} t={t} />
    </div>
  );
}

function Card({ title, hint, className = "", children }: {
  title: string; hint: string; className?: string; children: React.ReactNode;
}) {
  return <section className={`card ${className}`}>
    <div className="card-heading"><div><h2>{title}</h2><p>{hint}</p></div><span className="heading-line" /></div>
    <div className="card-content">{children}</div>
  </section>;
}

function ToolbarSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: string[][];
}) {
  return <label className="toolbar-select"><span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
    </select>
  </label>;
}

function FillField({ id, label, value, onChange, error, t }: {
  id: string; label: string; value: number; onChange: (value: number) => void;
  error?: string; t: ReturnType<typeof createTranslator>;
}) {
  return <div className="fill-field"><NumberField id={id} label={label} value={value}
    onChange={onChange} errorCode={error} t={t} min={0} max={255} />
    <code>{hexByte(value)}</code></div>;
}

function Progress({ progress, t, locale }: {
  progress: GenerationProgress; t: ReturnType<typeof createTranslator>; locale: string;
}) {
  const percent = progress.totalBytes > 0 ? Math.min(100, progress.bytesWritten / progress.totalBytes * 100) : 0;
  const speed = progress.elapsedMs > 0 ? progress.bytesWritten / (progress.elapsedMs / 1000) : 0;
  const remaining = speed > 0 ? (progress.totalBytes - progress.bytesWritten) / speed * 1000 : 0;
  return <div className="progress-area"><div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
    <div className="progress-meta"><strong>{percent.toFixed(1)}%</strong>
      <span>{t(`stage.${progress.stage}`)}</span>
      <span>{t("progress.frame")} {progress.currentFrame}/{progress.frameCount}</span>
      <span>{formatBytes(progress.bytesWritten, locale)} · {formatBytes(speed, locale)}/s</span>
      <span>{t("progress.remaining")} {formatDuration(remaining)}</span></div></div>;
}

function progressDetail(progress: GenerationProgress | null, t: ReturnType<typeof createTranslator>, locale: string) {
  if (!progress) return "";
  return `${t(`stage.${progress.stage}`)} · ${formatInteger(progress.bytesWritten, locale)} B`;
}

function defaultFileName(config: RawConfig) {
  return `gRAW_${config.width}x${config.height}_${cfaLabel(config.cfaPattern)}_${config.bitDepth}bit_${storageLabel(config.storageFormat)}.raw`;
}

function storageLabel(value: StorageFormat) {
  return value.replace("unpacked", "Unpacked").replace("mipi", "MIPI");
}

function cfaLabel(value: CfaPattern) {
  if (value === "mono") return "Mono";
  if (value.startsWith("quad")) return `Quad ${value.slice(4).toUpperCase()}`;
  return value.toUpperCase();
}

function useStoredState<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => (localStorage.getItem(key) as T) || fallback);
  useEffect(() => localStorage.setItem(key, value), [key, value]);
  return [value, setValue] as const;
}

export default App;
