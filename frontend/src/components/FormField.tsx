import type { ReactNode } from 'react';
import HelpTooltip from './HelpTooltip';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function FormField({ label, htmlFor, description, required, error, children }: FormFieldProps) {
  // Most callers bake the "*" straight into the label string (e.g. "Task Name
  // *") rather than passing `required` -- strip it off and re-render it as
  // the colored badge below so every mandatory-field marker looks the same.
  const trimmed = label.trimEnd();
  const hasInlineAsterisk = trimmed.endsWith('*');
  const baseLabel = hasInlineAsterisk ? trimmed.slice(0, -1).trimEnd() : label;

  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <div className="form-field__label-row">
        <label className="form-field__label" htmlFor={htmlFor}>
          {baseLabel}
          {(required || hasInlineAsterisk) && <span className="form-field__required"> *</span>}
        </label>
        {description && <HelpTooltip label={baseLabel} description={description} />}
      </div>
      {children}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export default FormField;
