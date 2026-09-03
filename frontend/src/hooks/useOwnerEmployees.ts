import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getEmployees } from '../api/employees';
import type { Employee } from '../types/employee';

interface OwnerEmployeesState {
  employees: Employee[];
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the owner's employees. Fetched once per DashboardShell session and
 * shared, so Home and Employees both read one list rather than each fetching
 * their own on every tab switch.
 */
export function useOwnerEmployees(): OwnerEmployeesState {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getEmployees()
      .then((result) => {
        if (active) setEmployees(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load employees');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { employees, setEmployees, isLoading, error, reload };
}
