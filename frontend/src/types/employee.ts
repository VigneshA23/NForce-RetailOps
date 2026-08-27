export type ShiftName = 'Morning' | 'Afternoon' | 'Evening';

export type EmployeeType = 'Full Time' | 'Part Time';

export type Gender = 'Male' | 'Female' | 'Non-binary';

<<<<<<< Updated upstream
export interface Employee {
  id: number;
  empId: string;
  name: string;
  email: string;
  phone: string;
  shift: ShiftName;
  type: EmployeeType;
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
=======
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
  type: EmployeeType;
  gender: Gender;
  active: boolean;
  storeId: number;
  storeName: string;
}

export interface EmployeeFormValues {
  name: string;
  email: string;
  password: string;
  phone: string;
  shift: ShiftName;
  type: EmployeeType;
  gender: Gender;
  storeId: number;
}
>>>>>>> Stashed changes
