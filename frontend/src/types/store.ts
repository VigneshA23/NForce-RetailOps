export type StoreStatus = 'Open' | 'Closed';

export interface StoreSummary {
  id: number;
  name: string;
  location: string | null;
  status: StoreStatus;
}
