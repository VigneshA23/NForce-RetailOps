import type { EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { EMPLOYEE_TYPE_OPTIONS, GENDER_OPTIONS, SHIFT_OPTIONS } from '../utils/employeeOptions';
import { COUNTRY_CODE_OPTIONS, parsePhoneForForm } from '../utils/countryCodes';
import FormField from './FormField';
import MultiSelect from './MultiSelect';
import Select from './Select';

export type EmployeeFormValues = EmployeeUpdateValues & { countryCode: string };

export function emptyEmployeeFormValues(): EmployeeFormValues {
  return {
    name: '',
    storeIds: [],
    shift: SHIFT_OPTIONS[0].name,
    phone: '',
    countryCode: COUNTRY_CODE_OPTIONS[0].code,
    employeeType: EMPLOYEE_TYPE_OPTIONS[0],
    email: '',
    gender: GENDER_OPTIONS[0],
  };
}

export function employeeFormValuesFromUpdate(initialValues: EmployeeUpdateValues): EmployeeFormValues {
  const { countryCode, phone } = parsePhoneForForm(initialValues.phone);
  return { ...initialValues, phone, countryCode };
}

interface EmployeeFormFieldsProps {
  values: EmployeeFormValues;
  errors: Partial<Record<keyof EmployeeCreateValues, string>>;
  storeOptions: StoreOption[];
  onChange: <K extends keyof EmployeeFormValues>(field: K, value: EmployeeFormValues[K]) => void;
  /** Distinguishes DOM ids when this renders inside more than one modal, e.g. the edit-in-place popup. */
  idPrefix?: string;
}

function EmployeeFormFields({ values, errors, storeOptions, onChange, idPrefix = 'employee' }: EmployeeFormFieldsProps) {
  return (
    <>
      <div className="form-field--full">
        <FormField label="Name" htmlFor={`${idPrefix}-name`} required error={errors.name}>
          <input
            id={`${idPrefix}-name`}
            className="input"
            value={values.name}
            onChange={(event) => onChange('name', event.target.value)}
          />
        </FormField>
      </div>

      <div className="form-field--full">
        <FormField label="Assigned Stores" htmlFor={`${idPrefix}-stores`} error={errors.storeIds}>
          <MultiSelect
            id={`${idPrefix}-stores`}
            options={storeOptions.map((store) => ({ id: store.id, label: store.name }))}
            value={values.storeIds}
            onChange={(ids) => onChange('storeIds', ids)}
            placeholder="Select stores..."
            searchPlaceholder="Search stores..."
          />
        </FormField>
      </div>

      <FormField label="Shift" htmlFor={`${idPrefix}-shift`} required error={errors.shift}>
        <Select
          id={`${idPrefix}-shift`}
          value={values.shift}
          onChange={(value) => onChange('shift', value as EmployeeFormValues['shift'])}
          options={SHIFT_OPTIONS.map((shift) => ({
            value: shift.name,
            label: `${shift.name} (${shift.timeRange})`,
          }))}
        />
      </FormField>

      <FormField label="Type" htmlFor={`${idPrefix}-type`} required error={errors.employeeType}>
        <Select
          id={`${idPrefix}-type`}
          value={values.employeeType}
          onChange={(value) => onChange('employeeType', value as EmployeeFormValues['employeeType'])}
          options={EMPLOYEE_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
        />
      </FormField>

      <FormField label="Contact" htmlFor={`${idPrefix}-phone`} required error={errors.phone}>
        <div className="employee-form__phone-row">
          <Select
            id={`${idPrefix}-country-code`}
            className="employee-form__country-code"
            ariaLabel="Country code"
            value={values.countryCode}
            onChange={(value) => onChange('countryCode', value)}
            options={COUNTRY_CODE_OPTIONS.map((option) => ({ value: option.code, label: option.label }))}
          />
          <input
            id={`${idPrefix}-phone`}
            className="input"
            inputMode="numeric"
            value={values.phone}
            onChange={(event) => onChange('phone', event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit number"
          />
        </div>
      </FormField>

      <FormField label="Gender" htmlFor={`${idPrefix}-gender`} error={errors.gender}>
        <Select
          id={`${idPrefix}-gender`}
          value={values.gender}
          onChange={(value) => onChange('gender', value as EmployeeFormValues['gender'])}
          options={GENDER_OPTIONS.map((gender) => ({ value: gender, label: gender }))}
        />
      </FormField>

      <div className="form-field--full">
        <FormField label="Email" htmlFor={`${idPrefix}-email`} required error={errors.email}>
          <input
            id={`${idPrefix}-email`}
            type="email"
            className="input"
            value={values.email}
            onChange={(event) => onChange('email', event.target.value)}
          />
        </FormField>
      </div>
    </>
  );
}

export default EmployeeFormFields;
