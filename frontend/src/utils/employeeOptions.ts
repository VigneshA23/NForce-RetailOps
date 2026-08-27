import type { EmployeeType, Gender, ShiftName } from '../types/employee';

export const SHIFT_OPTIONS: { name: ShiftName; timeRange: string }[] = [
  { name: 'Morning', timeRange: '6AM-2PM' },
  { name: 'Afternoon', timeRange: '2PM-10PM' },
  { name: 'Evening', timeRange: '4PM-12AM' },
];

export const EMPLOYEE_TYPE_OPTIONS: EmployeeType[] = ['Full Time', 'Part Time'];

export const GENDER_OPTIONS: Gender[] = ['Male', 'Female', 'Non-binary'];
