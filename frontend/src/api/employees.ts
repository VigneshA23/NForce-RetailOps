<<<<<<< Updated upstream
import type { Employee, EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { authHeaders } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getEmployees(): Promise<Employee[]> {
  const response = await fetch(`${API_BASE_URL}/employees`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load employees'));
  return response.json();
}

export async function getAssignableStores(): Promise<StoreOption[]> {
  const response = await fetch(`${API_BASE_URL}/employees/stores`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load stores'));
  return response.json();
}

export async function createEmployee(values: EmployeeCreateValues): Promise<Employee> {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to create employee'));
  return response.json();
}

export async function updateEmployee(id: number, values: EmployeeUpdateValues): Promise<Employee> {
  const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to update employee'));
  return response.json();
}

export async function deleteEmployee(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to delete employee'));
=======
import { apiRequest } from './client';
import type { Employee, EmployeeFormValues } from '../types/employee';

interface EmployeeResponseDto {
  id: number;
  empId: string;
  fullName: string;
  email: string;
  phone: string;
  shift: string;
  employmentType: string;
  gender: string;
  active: boolean;
  storeId: number;
  storeName: string;
}

function toEmployee(dto: EmployeeResponseDto): Employee {
  return {
    id: dto.id,
    empId: dto.empId,
    name: dto.fullName,
    email: dto.email,
    phone: dto.phone,
    shift: dto.shift as Employee['shift'],
    type: dto.employmentType as Employee['type'],
    gender: dto.gender as Employee['gender'],
    active: dto.active,
    storeId: dto.storeId,
    storeName: dto.storeName,
  };
}

export async function getEmployees(token: string): Promise<Employee[]> {
  const employees = await apiRequest<EmployeeResponseDto[]>('/employees', { token });
  return employees.map(toEmployee);
}

export async function createEmployee(token: string, values: EmployeeFormValues): Promise<Employee> {
  const dto = await apiRequest<EmployeeResponseDto>('/employees', {
    method: 'POST',
    token,
    body: {
      fullName: values.name,
      email: values.email,
      password: values.password,
      phone: values.phone,
      shift: values.shift,
      employmentType: values.type,
      gender: values.gender,
      storeId: values.storeId,
    },
  });
  return toEmployee(dto);
}

export async function updateEmployee(
  token: string,
  employeeId: number,
  values: EmployeeFormValues,
): Promise<Employee> {
  const dto = await apiRequest<EmployeeResponseDto>(`/employees/${employeeId}`, {
    method: 'PUT',
    token,
    body: {
      fullName: values.name,
      email: values.email,
      phone: values.phone,
      shift: values.shift,
      employmentType: values.type,
      gender: values.gender,
      storeId: values.storeId,
    },
  });
  return toEmployee(dto);
}

export async function updateEmployeeStatus(
  token: string,
  employeeId: number,
  active: boolean,
): Promise<Employee> {
  const dto = await apiRequest<EmployeeResponseDto>(`/employees/${employeeId}/status`, {
    method: 'PATCH',
    token,
    body: { active },
  });
  return toEmployee(dto);
>>>>>>> Stashed changes
}
