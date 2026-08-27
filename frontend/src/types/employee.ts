export type ShiftName = 'Morning' | 'Afternoon' | 'Evening';

export type EmployeeType = 'Full Time' | 'Part Time';

export type Gender = 'Male' | 'Female' | 'Non-binary';

export interface Employee {
  id: number;
  empId: string;
  name: string;
  email: string;
  phone: string;
  shift: ShiftName;
  employeeType: EmployeeType;
  gender: Gender;
  storeId: number;
  storeName: string;
}

export interface StoreOption {
  id: number;
  name: string;
}

export type EmployeeUpdateValues = Omit<Employee, 'id' | 'empId' | 'storeName'>;

export type EmployeeCreateValues = EmployeeUpdateValues & { password: string };
