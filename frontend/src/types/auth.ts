export type Role = 'EMPLOYEE' | 'OWNER_ADMIN'

export interface AuthUser {
  token: string
  role: Role
  fullName: string
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER_ADMIN: 'Owner / Admin',
  EMPLOYEE: 'Employee',
}
