import type { Translate } from "../i18n";
import { THIRD_PARTY_COMPONENTS } from "../generated/licenses";
import { BrandIcon } from "./BrandIcon";

export function AboutDialog({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: Translate;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label={t("action.close")}>
          ×
        </button>
        <div className="about-heading">
          <BrandIcon size={72} />
          <div>
            <h2 id="about-title">gRAW</h2>
            <p>{t("about.product")}</p>
            <span>V0.0.1</span>
          </div>
        </div>
        <p className="about-description">{t("about.description")}</p>
        <div className="about-facts">
          <Fact label={t("about.version")} value="V0.0.1" />
          <Fact label={t("about.buildDate")} value={__BUILD_DATE__} />
          <Fact label={t("about.platform")} value={t("about.platformValue")} />
          <Fact label={t("about.designer")} value={t("about.designerValue")} />
          <Fact label={t("about.implementation")} value={t("about.implementationValue")} />
        </div>
        <div className="license-section">
          <div className="license-heading">
            <h3>{t("about.licenses")}</h3>
            <p>{t("about.licenseHint")} · {THIRD_PARTY_COMPONENTS.length}</p>
          </div>
          <div className="license-list">
            {THIRD_PARTY_COMPONENTS.map((component) => (
              <div
                className="license-row"
                key={`${component.ecosystem}:${component.name}@${component.version}`}
                title={component.homepage}
              >
                <strong>{component.name}</strong>
                <span>{component.ecosystem} · {component.version}</span>
                <code>{component.license}</code>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
