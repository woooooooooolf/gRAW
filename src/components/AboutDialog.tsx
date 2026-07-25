import { useEffect, useState } from "react";
import type { Translate } from "../i18n";
import { THIRD_PARTY_COMPONENTS } from "../generated/licenses";

type AboutView = "about" | "licenses";

export function AboutDialog({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: Translate;
}) {
  const [view, setView] = useState<AboutView>("about");

  useEffect(() => {
    if (open) setView("about");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (view === "licenses") setView("about");
        else onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, view]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`about-dialog view-${view}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {view === "about" ? (
          <AboutOverview onClose={onClose} onOpenLicenses={() => setView("licenses")} t={t} />
        ) : (
          <LicenseView onBack={() => setView("about")} t={t} />
        )}
      </section>
    </div>
  );
}

function AboutOverview({
  onClose,
  onOpenLicenses,
  t,
}: {
  onClose: () => void;
  onOpenLicenses: () => void;
  t: Translate;
}) {
  return (
    <div className="about-overview">
      <button className="modal-close" onClick={onClose} aria-label={t("action.close")}>
        ×
      </button>
      <div className="about-heading">
        <img className="about-app-icon" src="/graw-icon.svg" alt="" />
        <div>
          <h2 id="about-title">gRAW</h2>
          <p>{t("about.product")}</p>
          <span>V0.0.2</span>
        </div>
      </div>
      <p className="about-description">{t("about.description")}</p>
      <div className="about-facts">
        <Fact label={t("about.version")} value="V0.0.2" />
        <Fact label={t("about.buildDate")} value={__BUILD_DATE__} />
        <Fact label={t("about.platform")} value={t("about.platformValue")} />
        <Fact label={t("about.designer")} value={t("about.designerValue")} />
        <Fact label={t("about.implementation")} value={t("about.implementationValue")} />
      </div>
      <button className="license-entry" onClick={onOpenLicenses}>
        <span>
          <strong>{t("about.licenses")}</strong>
          <small>
            {t("about.componentCount").replace(
              "{count}",
              String(THIRD_PARTY_COMPONENTS.length),
            )}
          </small>
        </span>
        <span className="license-entry-label">{t("about.licenseEntry")}</span>
        <i aria-hidden="true">›</i>
      </button>
    </div>
  );
}

function LicenseView({ onBack, t }: { onBack: () => void; t: Translate }) {
  return (
    <div className="license-view">
      <header className="license-view-header">
        <button className="back-button" onClick={onBack}>
          <span aria-hidden="true">‹</span>
          {t("action.back")}
        </button>
        <div>
          <h2 id="about-title">{t("about.licenses")}</h2>
          <p>
            {t("about.licenseHint")} ·{" "}
            {t("about.componentCount").replace(
              "{count}",
              String(THIRD_PARTY_COMPONENTS.length),
            )}
          </p>
        </div>
      </header>
      <div className="license-list">
        {THIRD_PARTY_COMPONENTS.map((component) => (
          <div
            className="license-row"
            key={`${component.ecosystem}:${component.name}@${component.version}`}
            title={component.homepage}
          >
            <strong>{component.name}</strong>
            <span>{component.version}</span>
            <small>{component.ecosystem}</small>
            <code>{component.license}</code>
          </div>
        ))}
      </div>
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
