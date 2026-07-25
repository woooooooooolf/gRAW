import { useEffect, useState, type ReactNode } from "react";
import type { Translate } from "../i18n";
import { normalizeUnsignedInteger } from "../input";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className = "",
  children,
}: FieldProps) {
  return (
    <div className={`field ${error ? "field-error" : ""} ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {(error || hint) && (
        <span className={error ? "field-message error" : "field-message"}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onValidityChange?: (id: string, invalid: boolean) => void;
  errorCode?: string;
  t: Translate;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  hint?: string;
  className?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  onValidityChange,
  errorCode,
  t,
  min,
  max,
  suffix,
  disabled,
  hint,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  const empty = draft.length === 0;

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  useEffect(
    () => () => onValidityChange?.(id, false),
    [id, onValidityChange],
  );

  function handleChange(raw: string) {
    if (!/^\d*$/.test(raw)) return;
    const normalized = normalizeUnsignedInteger(raw);
    setDraft(normalized);
    onValidityChange?.(id, normalized === "");
    if (normalized !== "") onChange(Number(normalized));
  }

  return (
    <Field
      label={label}
      htmlFor={id}
      error={
        empty
          ? t("error.required")
          : errorCode
            ? t(`error.${errorCode}`)
            : undefined
      }
      hint={hint}
      className={className}
    >
      <div className="input-shell">
        <input
          id={id}
          type="text"
          role="spinbutton"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={disabled}
          aria-invalid={empty || Boolean(errorCode)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={empty ? undefined : Number(draft)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(event) => handleChange(event.currentTarget.value)}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
    </Field>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
  error,
  className,
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="select-shell">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="select-chevron">⌄</span>
      </div>
    </Field>
  );
}
