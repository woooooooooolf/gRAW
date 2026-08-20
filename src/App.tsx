import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  bitDepthsFor,
  calculateLayout,
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  formatBytes,
  formatDuration,
  formatInteger,
  hexByte,
  maxValue,
  testPatternGroupsFor,
  validateConfig,
  withBitDepth,
  withCfaPattern,
  withStorageFormat,
} from "./config";
import { createTranslator } from "./i18n";
import { FONT_SIZES, normalizeFontSize } from "./fontSize";
import { calculateViewportScale } from "./viewport";
import type {
  CfaPattern,
  Endianness,
  FontSize,
  FrameLayout,
  GenerationProgress,
  GenerationResult,
  Language,
  RawConfig,
  StorageFormat,
  TestPattern,
  ThemeId,
} from "./types";
import { AboutDialog } from "./components/AboutDialog";
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
const fontSizes: readonly FontSize[] = FONT_SIZES;
const languages: readonly Language[] = ["zh-CN", "en-US"];
const GENERATION_CANCELLED_ERROR = "generation_cancelled";
const themeOptions: {
  value: ThemeId;
  label: string;
  tone: "dark" | "light";
  background: string;
  surface: string;
  accent: string;
}[] = [
  { value: "deep-sea", label: "theme.deepSea", tone: "dark", background: "#071417", surface: "#143138", accent: "#32d6d2" },
  { value: "obsidian-violet", label: "theme.obsidianViolet", tone: "dark", background: "#100d16", surface: "#2a2037", accent: "#b58cff" },
  { value: "deep-space", label: "theme.deepSpace", tone: "dark", background: "#070c1b", surface: "#14264a", accent: "#5597ff" },
  { value: "glacier", label: "theme.glacier", tone: "light", background: "#eaf6f6", surface: "#ffffff", accent: "#008d95" },
  { value: "mist-violet", label: "theme.mistViolet", tone: "light", background: "#f4eff8", surface: "#fffaff", accent: "#8552b4" },
  { value: "clear-sky", label: "theme.clearSky", tone: "light", background: "#edf5fc", surface: "#ffffff", accent: "#2874c7" },
];

type RunState = "idle" | "generating" | "completed" | "cancelled" | "failed";
type ToolbarPanel = "language" | "theme" | "font" | null;

function App() {
  const [config, setConfig] = useState<RawConfig>(DEFAULT_CONFIG);
  const [language, setLanguage] = useStoredState<Language>(
    "graw-language",
    "zh-CN",
    languages,
  );
  const [theme, setTheme] = useThemePreference();
  const [fontSize, setFontSize] = useStoredFontSize();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [draftInvalid, setDraftInvalid] = useState<Record<string, true>>({});
  const [selectingOutput, setSelectingOutput] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const viewportScale = useViewportScale();
  const t = useMemo(() => createTranslator(language), [language]);
  const errors = useMemo(() => validateConfig(config), [config]);
  const hasDraftError = Object.keys(draftInvalid).length > 0;
  const valid = Object.keys(errors).length === 0 && !hasDraftError;
  const layout = useMemo(
    () => (valid ? calculateLayout(config) : null),
    [config, valid],
  );
  const maximum = maxValue(config.bitDepth);
  const busy = runState === "generating";
  const interactionLocked = selectingOutput || busy;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fontSize = fontSize;
    delete document.documentElement.dataset.palette;
    document.title = `gRAW · ${t("app.subtitle")}`;
  }, [fontSize, language, theme, t]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<GenerationProgress>("generation-progress", (event) => {
      if (!disposed) setProgress(event.payload);
    })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error) => {
        if (!disposed) setRuntimeError(String(error));
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const setDraftValidity = useCallback((id: string, invalid: boolean) => {
    setDraftInvalid((current) => {
      if (invalid && current[id]) return current;
      if (!invalid && !current[id]) return current;
      const next = { ...current };
      if (invalid) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  function resetRunFeedback() {
    if (runState !== "generating") {
      setRunState("idle");
      setProgress(null);
    }
    setRuntimeError("");
    setResult(null);
  }

  function update<K extends keyof RawConfig>(key: K, value: RawConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    resetRunFeedback();
  }

  function transformConfig(transform: (current: RawConfig) => RawConfig) {
    setConfig(transform);
    resetRunFeedback();
  }

  function updatePixel(key: keyof RawConfig["pixelValues"], value: number) {
    setConfig((current) => ({
      ...current,
      pixelValues: { ...current.pixelValues, [key]: value },
    }));
    resetRunFeedback();
  }

  async function generate() {
    if (!valid || interactionLocked) return;
    setSelectingOutput(true);
    setRunState("idle");
    setRuntimeError("");
    setResult(null);
    setProgress(null);
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
      if (message === GENERATION_CANCELLED_ERROR) setRunState("cancelled");
      else {
        setRuntimeError(message);
        setRunState("failed");
      }
    } finally {
      setSelectingOutput(false);
    }
  }

  async function cancel() {
    try {
      await invoke("cancel_generation");
    } catch (error) {
      setRuntimeError(String(error));
    }
  }

  async function revealOutput(outputPath: string) {
    try {
      await revealItemInDir(outputPath);
    } catch (error) {
      setRuntimeError(String(error));
    }
  }

  const firstError = hasDraftError ? "required" : Object.values(errors)[0];
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
  const numberFieldProps = { t, onValidityChange: setDraftValidity };

  return (
    <div
      className="viewport-stage"
      style={{ "--viewport-scale": viewportScale } as CSSProperties}
    >
      <div className="app-shell">
      <HeaderToolbar
        language={language}
        onLanguageChange={setLanguage}
        theme={theme}
        onThemeChange={setTheme}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        aboutOpen={aboutOpen}
        onAbout={() => setAboutOpen(true)}
        t={t}
      />

      <main
        className="workspace"
        aria-busy={interactionLocked}
        inert={interactionLocked}
      >
        <div className="workspace-grid">
          <Card title={t("section.image")} hint={t("section.imageHint")} className="image-card">
            <div className="card-split">
              <div className="form-grid compact">
                <NumberField id="width" label={t("field.width")} value={config.width}
                  onChange={(value) => update("width", value)} errorCode={errors.width}
                  min={1} max={CONFIG_LIMITS.dimension} suffix="px" {...numberFieldProps} />
                <NumberField id="height" label={t("field.height")} value={config.height}
                  onChange={(value) => update("height", value)} errorCode={errors.height}
                  min={1} max={CONFIG_LIMITS.dimension} suffix="px" {...numberFieldProps} />
                <SelectField id="cfa" label={t("field.cfa")} value={config.cfaPattern}
                  onChange={(value) => transformConfig((current) => withCfaPattern(current, value as CfaPattern))}
                  options={cfaPatterns.map((value) => ({ value, label: cfaLabel(value) }))}
                  className="span-2" />
              </div>
              <CfaPreview pattern={config.cfaPattern} values={config.pixelValues} maxValue={maximum} />
            </div>
          </Card>

          <Card title={t("section.pattern")} hint={t("section.patternHint")} className="pattern-card">
            <div className="pattern-top">
              <div className={`pattern-banner pattern-${config.testPattern}`}
                role="img" aria-label={t(`pattern.${config.testPattern}`)} />
              <div className="pattern-controls">
                <SelectField id="pattern" label={t("field.pattern")} value={config.testPattern}
                  onChange={(value) => update("testPattern", value as TestPattern)}
                  optionGroups={testPatternGroupsFor(config.cfaPattern).map((group) => ({
                    label: t(`patternGroup.${group.id}`),
                    options: group.patterns.map((value) => ({
                      value,
                      label: t(`pattern.${value}`),
                    })),
                  }))}
                  error={errors.testPattern ? t(`error.${errors.testPattern}`) : undefined} />
                {config.testPattern === "graySteps" && (
                  <NumberField id="gray-steps" label={t("field.graySteps")} value={config.graySteps}
                    onChange={(value) => update("graySteps", value)} errorCode={errors.graySteps}
                    min={2} max={256} {...numberFieldProps} />
                )}
                {config.testPattern === "checkerboard" && (
                  <NumberField id="checker-size" label={t("field.checkerSize")} value={config.checkerSize}
                    onChange={(value) => update("checkerSize", value)} errorCode={errors.checkerSize}
                    min={1} max={CONFIG_LIMITS.checkerSize} suffix="px" {...numberFieldProps} />
                )}
                {config.testPattern === "randomNoise" && (
                  <NumberField id="noise-seed" label={t("field.noiseSeed")} value={config.noiseSeed}
                    onChange={(value) => update("noiseSeed", value)} errorCode={errors.noiseSeed}
                    min={0} max={CONFIG_LIMITS.noiseSeed} {...numberFieldProps} />
                )}
              </div>
            </div>
            {config.testPattern === "fixed" && (
              <div className={`channel-grid ${config.cfaPattern === "mono" ? "mono" : ""}`}>
                {(config.cfaPattern === "mono"
                  ? (["mono"] as const)
                  : (["r", "gr", "gb", "b"] as const)
                ).map((channel) => (
                  <NumberField key={channel} id={`pixel-${channel}`} label={t(`field.${channel}`)}
                    value={config.pixelValues[channel]} onChange={(value) => updatePixel(channel, value)}
                    errorCode={errors[`pixelValues.${channel}`]} min={0} max={maximum}
                    suffix={`/ ${maximum}`} {...numberFieldProps} />
                ))}
              </div>
            )}
            <div className="fill-grid">
              <FillField id="offset-fill" label={t("field.offsetFill")} value={config.offsetFill}
                onChange={(value) => update("offsetFill", value)} error={errors.offsetFill}
                {...numberFieldProps} />
              <FillField id="row-fill" label={t("field.rowFill")} value={config.rowPaddingFill}
                onChange={(value) => update("rowPaddingFill", value)} error={errors.rowPaddingFill}
                {...numberFieldProps} />
              <FillField id="frame-fill" label={t("field.frameFill")} value={config.framePaddingFill}
                onChange={(value) => update("framePaddingFill", value)} error={errors.framePaddingFill}
                {...numberFieldProps} />
            </div>
          </Card>

          <Card title={t("section.storage")} hint={t("section.storageHint")} className="storage-card">
            <div className="storage-grid">
              <SelectField id="storage" label={t("field.storage")} value={config.storageFormat}
                onChange={(value) => transformConfig((current) => withStorageFormat(current, value as StorageFormat))}
                options={storageFormats.map((value) => ({ value, label: storageLabel(value) }))} />
              <SelectField id="bit-depth" label={t("field.bitDepth")} value={config.bitDepth}
                onChange={(value) => transformConfig((current) => withBitDepth(current, Number(value)))}
                options={bitDepthsFor(config.storageFormat).map((value) => ({ value, label: `${value} bit` }))}
                disabled={config.storageFormat !== "unpacked16"} />
              <SelectField id="endian" label={t("field.endian")} value={config.endianness}
                onChange={(value) => update("endianness", value as Endianness)}
                options={[{ value: "little", label: t("endian.little") }, { value: "big", label: t("endian.big") }]}
                disabled={config.storageFormat !== "unpacked16"} />
              <SelectField id="bit-align" label={t("field.bitAlignment")} value={config.bitAlignment}
                onChange={(value) => update("bitAlignment", value as "lsb" | "msb")}
                options={[{ value: "lsb", label: t("align.lsb") }, { value: "msb", label: t("align.msb") }]}
                disabled={config.storageFormat !== "unpacked16" || config.bitDepth === 16} />
            </div>
            <div className="format-note">
              <span className="status-orb" />
              {t(config.storageFormat.startsWith("mipi")
                ? "note.mipiLayout"
                : config.storageFormat === "unpacked8"
                  ? "note.unpacked8"
                  : "note.unpacked16")}
            </div>
          </Card>

          <Card title={t("section.file")} hint={t("section.fileHint")} className="file-card">
            <div className="file-grid">
              <NumberField id="frames" label={t("field.frameCount")} value={config.frameCount}
                onChange={(value) => update("frameCount", value)} errorCode={errors.frameCount}
                min={1} max={CONFIG_LIMITS.frameCount} {...numberFieldProps} />
              <NumberField id="offset" label={t("field.fileOffset")} value={config.fileOffset}
                onChange={(value) => update("fileOffset", value)} errorCode={errors.fileOffset}
                min={0} max={CONFIG_LIMITS.fileOffset} suffix="B" {...numberFieldProps} />
              <NumberField id="row-align" label={t("field.rowAlignment")} value={config.rowAlignment}
                onChange={(value) => update("rowAlignment", value)} errorCode={errors.rowAlignment}
                min={1} max={CONFIG_LIMITS.rowAlignment} suffix="B" {...numberFieldProps} />
              <NumberField id="frame-align" label={t("field.frameAlignment")} value={config.frameAlignment}
                onChange={(value) => update("frameAlignment", value)} errorCode={errors.frameAlignment}
                min={1} max={CONFIG_LIMITS.frameAlignment} suffix="B" {...numberFieldProps} />
            </div>
          </Card>

          <Card title={t("section.summary")} hint={t("section.summaryHint")} className="summary-card">
            <LayoutSummary config={config} layout={layout} t={t} locale={language} />
          </Card>
        </div>
      </main>

      <footer className={`statusbar state-${runState}`}>
        <div className="status-copy">
          <span
            className={`status-orb ${
              !valid || runtimeError || runState === "failed" ? "error" : ""
            }`}
          />
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
            <button className="secondary-button" onClick={() => void revealOutput(result.outputPath)}>
              {t("action.reveal")}
            </button>
          )}
          {busy ? (
            <button className="cancel-button" onClick={cancel}>{t("action.cancel")}</button>
          ) : (
            <button className="generate-button" disabled={!valid || selectingOutput} onClick={generate}>
              <span className="generate-icon">◇</span>{t("action.generate")}
            </button>
          )}
        </div>
      </footer>

        <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} t={t} />
      </div>
    </div>
  );
}

function HeaderToolbar({
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  fontSize,
  onFontSizeChange,
  aboutOpen,
  onAbout,
  t,
}: {
  language: Language;
  onLanguageChange: (value: Language) => void;
  theme: ThemeId;
  onThemeChange: (value: ThemeId) => void;
  fontSize: FontSize;
  onFontSizeChange: (value: FontSize) => void;
  aboutOpen: boolean;
  onAbout: () => void;
  t: ReturnType<typeof createTranslator>;
}) {
  const [panel, setPanel] = useState<ToolbarPanel>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;
    function closeOnOutside(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) setPanel(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [panel]);

  function choose<T>(action: (value: T) => void, value: T) {
    action(value);
    setPanel(null);
  }

  return (
    <header className="topbar">
      <div className="toolbar" ref={toolbarRef}>
        <ToolbarMenu label={t("header.language")} icon="language" open={panel === "language"}
          onToggle={() => setPanel(panel === "language" ? null : "language")}>
          <div className="simple-option-list">
            {languages.map((value) => (
              <button key={value} className={language === value ? "selected" : ""}
                onClick={() => choose(onLanguageChange, value)}>
                <span>{value === "zh-CN" ? "中文" : "EN"}</span>
                <strong>{value === "zh-CN" ? "中文" : "English"}</strong>
              </button>
            ))}
          </div>
        </ToolbarMenu>

        <ToolbarMenu label={t("header.theme")} icon="theme" open={panel === "theme"} wide
          onToggle={() => setPanel(panel === "theme" ? null : "theme")}>
          {(["dark", "light"] as const).map((tone) => (
            <div className="menu-section" key={tone}>
              <span className="menu-section-title">
                {t(tone === "dark" ? "theme.darkGroup" : "theme.lightGroup")}
              </span>
              <div className="theme-grid">
                {themeOptions.filter((option) => option.tone === tone).map((option) => (
                  <button key={option.value} className={theme === option.value ? "selected" : ""}
                    onClick={() => choose(onThemeChange, option.value)}>
                    <i className="theme-swatch" style={{
                      "--swatch-bg": option.background,
                      "--swatch-surface": option.surface,
                      "--swatch-accent": option.accent,
                    } as CSSProperties} />
                    <span>{t(option.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </ToolbarMenu>

        <ToolbarMenu label={t("header.fontSize")} icon="font" open={panel === "font"}
          onToggle={() => setPanel(panel === "font" ? null : "font")}>
          <div className="font-options">
            {fontSizes.map((value) => (
              <button key={value} className={fontSize === value ? "selected" : ""}
                onClick={() => choose(onFontSizeChange, value)}>
                <strong className={`font-sample ${value}`}>A</strong>
                <span>{t(`font.${value}`)}</span>
              </button>
            ))}
          </div>
        </ToolbarMenu>

        <button className={`toolbar-icon ${aboutOpen ? "active" : ""}`}
          title={t("header.about")} aria-label={t("header.about")} onClick={onAbout}>
          <ToolbarIcon kind="about" />
        </button>
      </div>
    </header>
  );
}

function ToolbarMenu({
  label,
  icon,
  open,
  wide = false,
  onToggle,
  children,
}: {
  label: string;
  icon: "language" | "theme" | "font";
  open: boolean;
  wide?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="toolbar-menu">
      <button className={`toolbar-icon ${open ? "active" : ""}`} title={label}
        aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        <ToolbarIcon kind={icon} />
      </button>
      {open && <div className={`toolbar-popover ${wide ? "wide" : ""}`}>{children}</div>}
    </div>
  );
}

function ToolbarIcon({ kind }: { kind: "language" | "theme" | "font" | "about" }) {
  if (kind === "language") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8S9.6 6.3 12 4Z" /></svg>;
  }
  if (kind === "theme") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" />
      <path d="M12 4v16a8 8 0 0 0 0-16Z" className="icon-fill" /></svg>;
  }
  if (kind === "font") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 18 5-13h2l5 13M7 13h8M16 9h4M18 9v9" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" />
    <path d="M12 10v6M12 7.3v.2" /></svg>;
}

function Card({ title, hint, className = "", children }: {
  title: string;
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  return <section className={`card ${className}`}>
    <div className="card-heading"><div><h2>{title}</h2><p>{hint}</p></div><span className="heading-line" /></div>
    <div className="card-content">{children}</div>
  </section>;
}

function FillField({ id, label, value, onChange, error, t, onValidityChange }: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  t: ReturnType<typeof createTranslator>;
  onValidityChange: (id: string, invalid: boolean) => void;
}) {
  return <div className="fill-field"><NumberField id={id} label={label} value={value}
    onChange={onChange} errorCode={error} t={t} min={0} max={255}
    onValidityChange={onValidityChange} />
    <code>{hexByte(value)}</code></div>;
}

function Progress({ progress, t, locale }: {
  progress: GenerationProgress;
  t: ReturnType<typeof createTranslator>;
  locale: string;
}) {
  const percent = progress.totalBytes > 0
    ? Math.min(100, progress.bytesWritten / progress.totalBytes * 100)
    : 0;
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

function useViewportScale() {
  const [scale, setScale] = useState(() =>
    calculateViewportScale(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    let animationFrame = 0;
    function updateScale() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setScale(calculateViewportScale(window.innerWidth, window.innerHeight));
      });
    }

    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return scale;
}

function useThemePreference() {
  const [value, setValue] = useState<ThemeId>(() => {
    const stored = localStorage.getItem("graw-theme-v2") as ThemeId | null;
    if (stored && themeOptions.some((option) => option.value === stored)) return stored;

    const oldTheme = localStorage.getItem("graw-theme") ?? "system";
    const oldPalette = localStorage.getItem("graw-palette") ?? "cyan";
    const light = oldTheme === "light" ||
      (oldTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (light) {
      if (oldPalette === "violet") return "mist-violet";
      if (oldPalette === "blue") return "clear-sky";
      return "glacier";
    }
    if (oldPalette === "violet") return "obsidian-violet";
    if (oldPalette === "blue") return "deep-space";
    return "deep-sea";
  });
  useEffect(() => localStorage.setItem("graw-theme-v2", value), [value]);
  return [value, setValue] as const;
}

function useStoredFontSize() {
  const [value, setValue] = useState<FontSize>(() =>
    normalizeFontSize(localStorage.getItem("graw-font-size")),
  );
  useEffect(() => localStorage.setItem("graw-font-size", value), [value]);
  return [value, setValue] as const;
}

function useStoredState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[] = [],
) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key) as T | null;
    if (!stored) return fallback;
    return allowed.length === 0 || allowed.includes(stored) ? stored : fallback;
  });
  useEffect(() => localStorage.setItem(key, value), [key, value]);
  return [value, setValue] as const;
}

export default App;
