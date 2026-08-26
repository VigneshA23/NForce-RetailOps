export type StoreName = 'Store 1' | 'Store 2' | 'Store 3';

export type ShiftName = 'Morning' | 'Afternoon' | 'Evening';

export type EmployeeType = 'Full Time' | 'Part Time';

export type Gender = 'Male' | 'Female' | 'Non-binary';

export interface Employee {
  empId: string;
  name: string;
  store: StoreName;
  shift: ShiftName;
  phone: string;
  type: EmployeeType;
  email: string;
  gender: Gender;
}

export type EmployeeFormValues = Omit<Employee, 'empId'>;
