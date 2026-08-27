export type StoreStatus = 'Open' | 'Closed';

export interface StoreSummary {
  id: string;
  name: string;
  status: StoreStatus;
}
