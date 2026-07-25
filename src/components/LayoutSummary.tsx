import {
  formatBytes,
  formatInteger,
} from "../config";
import type { Translate } from "../i18n";
import type { LocalLayout, RawConfig } from "../types";

export function LayoutSummary({
  config,
  layout,
  t,
  locale,
}: {
  config: RawConfig;
  layout: LocalLayout | null;
  t: Translate;
  locale: string;
}) {
  if (!layout) {
    return (
      <div className="layout-empty">
        <span className="status-orb error" />
        {t("status.invalid")}
      </div>
    );
  }

  const hasOffset = config.fileOffset > 0;
  const hasRowPadding = layout.rowPadding > 0n;
  const hasFramePadding = layout.framePadding > 0n;
  return (
    <>
      <div className="size-hero">
        <div>
          <span>{t("summary.total")}</span>
          <strong>{formatBytes(layout.totalSize, locale)}</strong>
        </div>
        <div className="exact-size">
          <span>{t("summary.exact")}</span>
          <code>{formatInteger(layout.totalSize, locale)} B</code>
        </div>
      </div>

      <div className="file-map" aria-label={t("section.summary")}>
        {hasOffset && (
          <div className="file-segment offset">
            <span>{t("summary.offset")}</span>
            <small>{formatBytes(config.fileOffset, locale)}</small>
          </div>
        )}
        <div className="file-segment frame primary">
          <span>{t("summary.frame")} 1</span>
          <small>{formatBytes(layout.frameData, locale)}</small>
          {hasRowPadding && <i className="row-padding-mark" />}
        </div>
        {hasFramePadding && (
          <div className="file-segment padding">
            <span>{t("summary.padding")}</span>
            <small>{formatBytes(layout.framePadding, locale)}</small>
          </div>
        )}
        {config.frameCount > 1 && (
          <>
            <div className="file-segment frame secondary">
              <span>{t("summary.frame")} 2</span>
              <small>{formatBytes(layout.frameData, locale)}</small>
            </div>
            {config.frameCount > 2 && (
              <div className="file-segment more">
                <span>× {config.frameCount - 2}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="metrics-grid">
        <Metric
          label={t("summary.rowPayload")}
          value={formatBytes(layout.rowPayload, locale)}
          exact={layout.rowPayload}
          locale={locale}
        />
        <Metric
          label={t("summary.rowStride")}
          value={formatBytes(layout.rowStride, locale)}
          exact={layout.rowStride}
          locale={locale}
        />
        <Metric
          label={t("summary.frameData")}
          value={formatBytes(layout.frameData, locale)}
          exact={layout.frameData}
          locale={locale}
        />
        <Metric
          label={t("summary.frameStride")}
          value={formatBytes(layout.frameStride, locale)}
          exact={layout.frameStride}
          locale={locale}
        />
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  exact,
  locale,
}: {
  label: string;
  value: string;
  exact: bigint;
  locale: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{formatInteger(exact, locale)} B</small>
    </div>
  );
}
