export type Role = 'EMPLOYEE' | 'OWNER_ADMIN' | 'SUPER_ADMIN'

export interface AuthUser {
  token: string
  role: Role
  fullName: string
}
