import type { ChecklistHistoryDetail, ChecklistHistoryOperationsReport, ChecklistHistorySummaryRow } from '../types/checklistHistory';
import { authHeaders } from '../utils/authStorage';
import { fetchWithTimeout } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

// Thrown on a 400 from the summary endpoint -- e.g. the backend rejecting a date
// range that's too wide, or too many stores selected -- so the page can show a
// targeted, user-actionable message instead of the generic load-error banner.
export class ChecklistHistoryRangeError extends Error {}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export interface ChecklistHistorySummaryParams {
  // Empty array means "all stores this owner has" -- the backend defaults to
  // that when the storeIds param is omitted entirely.
  storeIds: number[];
  startDate: string;
  endDate: string;
}

export async function getChecklistHistorySummary(
  params: ChecklistHistorySummaryParams,
): Promise<ChecklistHistorySummaryRow[]> {
  const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
  params.storeIds.forEach((id) => query.append('storeIds', String(id)));

  const response = await fetchWithTimeout(`${API_BASE_URL}/checklist-history/summary?${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, 'Failed to load checklist history');
    if (response.status === 400) {
      throw new ChecklistHistoryRangeError(message);
    }
    throw new Error(message);
  }

  return response.json();
}

export interface ChecklistHistoryOperationsReportParams {
  startDate: string;
  endDate: string;
}

// Daily Operations Summary report -- deliberately takes no storeId/storeIds:
// the backend always resolves the caller's own authorized store(s), so the
// frontend cannot request (and does not need a picker for) another store.
export async function getChecklistHistoryOperationsReport(
  params: ChecklistHistoryOperationsReportParams,
): Promise<ChecklistHistoryOperationsReport> {
  const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });

  const response = await fetchWithTimeout(`${API_BASE_URL}/checklist-history/operations-summary?${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, 'Failed to load the operations summary');
    if (response.status === 400) {
      throw new ChecklistHistoryRangeError(message);
    }
    throw new Error(message);
  }

  return response.json();
}

export async function getChecklistHistoryDetail(storeId: number, date: string): Promise<ChecklistHistoryDetail> {
  const query = new URLSearchParams({ storeId: String(storeId), date });
  const response = await fetchWithTimeout(`${API_BASE_URL}/checklist-history/detail?${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load checklist detail'));
  }

  return response.json();
}
