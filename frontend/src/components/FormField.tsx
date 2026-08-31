import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function FormField({ label, htmlFor, required, error, children }: FormFieldProps) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label className="form-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="form-field__required"> *</span>}
      </label>
      {children}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export default FormField;
