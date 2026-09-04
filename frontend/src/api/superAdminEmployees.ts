import { apiRequest } from './client';
import type { Employee, EmployeeCreateValues } from '../types/employee';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';

// Read-only, cross-owner directory for the Super Admin's Employees page.
export async function getAllEmployeesForSuperAdmin(): Promise<SuperAdminEmployee[]> {
  return apiRequest<SuperAdminEmployee[]>('/employees/all');
}

export interface EmployeeCreationResult {
  employee: Employee;
  temporaryPassword: string;
}

// Created with no store -- an Owner assigns their own store to it afterward.
export async function createEmployeeAsSuperAdmin(values: EmployeeCreateValues): Promise<EmployeeCreationResult> {
  return apiRequest<EmployeeCreationResult>('/employees', { method: 'POST', body: values });
}
