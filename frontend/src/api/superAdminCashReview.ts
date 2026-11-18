import { apiRequest } from './client';
import type {
  SuperAdminCashCorrectionRequest,
  SuperAdminCashFlagRequest,
  SuperAdminCashReview,
} from '../types/superAdminCashReview';

// All write endpoints return the refreshed review payload for the same
// (store, date) so the UI never has to make a second fetch to reconcile.

export function getSuperAdminCashReview(
  storeId: number,
  date: string,
  signal?: AbortSignal,
): Promise<SuperAdminCashReview> {
  return apiRequest<SuperAdminCashReview>(
    `/super-admin/stores/${storeId}/cash/review?date=${date}`,
    { signal },
  );
}

export function correctSuperAdminCashEntry(
  storeId: number,
  entryId: number,
  request: SuperAdminCashCorrectionRequest,
): Promise<SuperAdminCashReview> {
  return apiRequest<SuperAdminCashReview>(
    `/super-admin/stores/${storeId}/cash/review/entries/${entryId}/correct`,
    { method: 'PUT', body: request },
  );
}

export function raiseSuperAdminCashFlag(
  storeId: number,
  entryId: number,
  request: SuperAdminCashFlagRequest,
): Promise<SuperAdminCashReview> {
  return apiRequest<SuperAdminCashReview>(
    `/super-admin/stores/${storeId}/cash/review/entries/${entryId}/flag`,
    { method: 'POST', body: request },
  );
}

export function editSuperAdminCashFlag(
  storeId: number,
  entryId: number,
  request: SuperAdminCashFlagRequest,
): Promise<SuperAdminCashReview> {
  return apiRequest<SuperAdminCashReview>(
    `/super-admin/stores/${storeId}/cash/review/entries/${entryId}/flag`,
    { method: 'PATCH', body: request },
  );
}

export function removeSuperAdminCashFlag(
  storeId: number,
  entryId: number,
): Promise<SuperAdminCashReview> {
  return apiRequest<SuperAdminCashReview>(
    `/super-admin/stores/${storeId}/cash/review/entries/${entryId}/flag`,
    { method: 'DELETE' },
  );
}
