import type { ReactNode } from "react";
import type { Translate } from "../i18n";

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
  errorCode?: string;
  t: Translate;
  min?: number;
  max?: number;
  step?: number;
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
  errorCode,
  t,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  hint,
  className,
}: NumberFieldProps) {
  return (
    <Field
      label={label}
      htmlFor={id}
      error={errorCode ? t(`error.${errorCode}`) : undefined}
      hint={hint}
      className={className}
    >
      <div className="input-shell">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
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
