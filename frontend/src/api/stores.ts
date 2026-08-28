import type { StoreSummary } from '../types/store'
import { authHeaders } from '../utils/authStorage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

interface EmployeeStoreDto {
  id: number
  name: string
  active: boolean
}

export async function getAuthorizedStores(): Promise<StoreSummary[]> {
  const response = await fetch(`${API_BASE_URL}/employee/stores`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to load your stores')
  }

  const stores: EmployeeStoreDto[] = await response.json()
  return stores.map((store) => ({
    id: String(store.id),
    name: store.name,
    status: store.active ? 'Open' : 'Closed',
  }))
}
