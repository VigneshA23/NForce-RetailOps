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
}

// Personal-info edit only -- store assignment is handled separately via the
// directory assign/unassign actions, not this form.
export type EmployeeUpdateValues = EmployeeFormValues;

// Created by the Super Admin, with no store field at all.
export type EmployeeCreateValues = EmployeeFormValues;

// Owner-facing, cross-owner directory entry used to find an existing employee
// and assign the caller's own store to them.
export interface EmployeeDirectoryEntry {
  id: number;
  empId: string;
  name: string;
  email: string;
  phone: string;
  stores: StoreOption[];
  assignedToMyStore: boolean;
}
