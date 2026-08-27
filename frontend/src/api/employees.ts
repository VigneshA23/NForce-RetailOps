import type { Employee } from '../types/employee';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    empId: 'EMP-001',
    name: 'Alex Johnson',
    store: 'Store 1',
    shift: 'Morning',
    phone: '(555) 201-3344',
    type: 'Full Time',
    email: 'alexjohnson@nforceone.com',
    gender: 'Male',
  },
  {
    empId: 'EMP-002',
    name: 'Priya Natarajan',
    store: 'Store 2',
    shift: 'Afternoon',
    phone: '(555) 201-7788',
    type: 'Full Time',
    email: 'priya.n@nforceone.com',
    gender: 'Female',
  },
  {
    empId: 'EMP-003',
    name: 'Jordan Lee',
    store: 'Store 2',
    shift: 'Evening',
    phone: '(555) 201-9021',
    type: 'Part Time',
    email: 'jordan.lee@nforceone.com',
    gender: 'Non-binary',
  },
  {
    empId: 'EMP-004',
    name: 'Morgan Diaz',
    store: 'Store 1',
    shift: 'Morning',
    phone: '(555) 201-4471',
    type: 'Part Time',
    email: 'morgan.diaz@nforceone.com',
    gender: 'Female',
  },
  {
    empId: 'EMP-005',
    name: 'Sam Carter',
    store: 'Store 3',
    shift: 'Afternoon',
    phone: '(555) 201-5528',
    type: 'Full Time',
    email: 'sam.carter@nforceone.com',
    gender: 'Male',
  },
];

const SIMULATED_LATENCY_MS = 300;

export async function getEmployees(): Promise<Employee[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_EMPLOYEES.map((employee) => ({ ...employee }))), SIMULATED_LATENCY_MS);
  });
}

// TODO: once the backend exposes /api/employees, add createEmployee/updateEmployee/deleteEmployee
// here as fetch calls against VITE_API_BASE_URL and swap the local-state mutations in
// src/pages/Employees.tsx for calls into these.
