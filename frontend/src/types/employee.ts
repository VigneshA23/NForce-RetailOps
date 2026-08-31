export type ShiftName = 'Morning' | 'Afternoon' | 'Evening';

export type EmployeeType = 'Full Time' | 'Part Time';

export type Gender = 'Male' | 'Female' | 'Non-binary';

export interface StoreOption {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  empId: string;
  name: string;
  email: string;
  phone: string;
  shift: ShiftName;
  employeeType: EmployeeType;
  gender: Gender;
  active: boolean;
  stores: StoreOption[];
}

export interface EmployeeFormValues {
  name: string;
  email: string;
  phone: string;
  shift: ShiftName;
  employeeType: EmployeeType;
  gender: Gender;
  storeIds: number[];
}

export type EmployeeUpdateValues = EmployeeFormValues;

export type EmployeeCreateValues = EmployeeFormValues & { password: string };
