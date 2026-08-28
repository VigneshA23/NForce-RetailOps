import type { AdminTaskFormValues } from '../types/adminTask';

export type AdminTaskFormErrors = Partial<Record<keyof AdminTaskFormValues, string>>;

const ALPHANUMERIC_WITH_SPACES = /^[A-Za-z0-9 ]*$/;

export function emptyTaskFormValues(): AdminTaskFormValues {
  return {
    name: '',
    categoryId: null,
    appliesToAllStores: false,
    storeIds: [],
    responseType: null,
    responseNote: '',
    numericUnit: '',
    numericMin: '',
    numericMax: '',
    completionType: null,
    scheduleType: null,
    selectedDays: [],
    startDate: '',
    endDate: '',
    active: true,
  };
}

export function validateTaskForm(values: AdminTaskFormValues): AdminTaskFormErrors {
  const errors: AdminTaskFormErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Task name is required';
  }

  if (!values.categoryId) {
    errors.categoryId = 'Category is required';
  }

  if (!values.appliesToAllStores && values.storeIds.length === 0) {
    errors.storeIds = 'Select at least one store, or choose All Stores';
  }

  if (!values.responseType) {
    errors.responseType = 'Response type is required';
  } else if (values.responseType === 'NUMERIC') {
    const min = values.numericMin.trim();
    const max = values.numericMax.trim();
    if (min !== '' && Number.isNaN(Number(min))) {
      errors.numericMin = 'Enter a valid number';
    }
    if (max !== '' && Number.isNaN(Number(max))) {
      errors.numericMax = 'Enter a valid number';
    }
    if (min !== '' && max !== '' && !Number.isNaN(Number(min)) && !Number.isNaN(Number(max)) && Number(min) > Number(max)) {
      errors.numericMax = 'Minimum Value cannot be greater than Maximum Value';
    }
  } else if (values.responseType === 'TEXT') {
    const note = values.responseNote.trim();
    if (!note) {
      errors.responseNote = 'Text Response is required';
    } else if (note.length > 100) {
      errors.responseNote = 'Text Response must be 100 characters or fewer';
    } else if (!ALPHANUMERIC_WITH_SPACES.test(note)) {
      errors.responseNote = 'Text Response can only contain letters, numbers, and spaces';
    }
  }

  if (!values.completionType) {
    errors.completionType = 'Completion type is required';
  }

  if (!values.scheduleType) {
    errors.scheduleType = 'Schedule is required';
  } else if (values.scheduleType === 'SELECTED_DAYS' && values.selectedDays.length === 0) {
    errors.selectedDays = 'Select at least one day';
  }

  if (!values.startDate) {
    errors.startDate = 'Start date is required';
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'End date cannot be before start date';
  }

  return errors;
}
