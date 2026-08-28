import type { CompletionType, DayCode, ResponseType, ScheduleType } from '../types/adminTask';

export const RESPONSE_TYPE_OPTIONS: { value: ResponseType; label: string; helper: string }[] = [
  { value: 'YES_NO', label: 'Yes / No', helper: 'e.g. "Is the refrigerator temperature within range?"' },
  { value: 'DONE_NOT_DONE', label: 'Done / Not Done', helper: 'e.g. "Clean the front counter."' },
  { value: 'NUMERIC', label: 'Numeric Value', helper: 'e.g. "Record refrigerator temperature."' },
  { value: 'TEXT', label: 'Text Response', helper: 'e.g. "Enter any observations."' },
];

export const COMPLETION_TYPE_OPTIONS: { value: CompletionType; label: string; helper: string }[] = [
  {
    value: 'SINGLE',
    label: 'Single Completion',
    helper: 'The employee can complete the task once during the scheduled period.',
  },
  {
    value: 'MULTIPLE',
    label: 'Multiple Completions',
    helper: 'The employee can submit the task multiple times during the scheduled period.',
  },
];

export const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: 'EVERY_DAY', label: 'Every Day' },
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'WEEKENDS', label: 'Weekends' },
  { value: 'SELECTED_DAYS', label: 'Selected Days' },
];

export const DAY_OPTIONS: { value: DayCode; label: string }[] = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

export function scheduleSummary(scheduleType: ScheduleType, selectedDays: DayCode[]): string {
  switch (scheduleType) {
    case 'EVERY_DAY':
      return 'Every day';
    case 'WEEKDAYS':
      return 'Weekdays';
    case 'WEEKENDS':
      return 'Weekends';
    case 'SELECTED_DAYS':
      return selectedDays.length > 0 ? selectedDays.join(', ') : 'Selected days';
    default:
      return scheduleType;
  }
}

export function responseTypeLabel(responseType: ResponseType): string {
  return RESPONSE_TYPE_OPTIONS.find((option) => option.value === responseType)?.label ?? responseType;
}

export function completionTypeLabel(completionType: CompletionType): string {
  return COMPLETION_TYPE_OPTIONS.find((option) => option.value === completionType)?.label ?? completionType;
}
