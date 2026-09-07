import { useEffect, useState } from 'react';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import type { StoreOperationsSummary } from '../api/superAdminOperations';
import { todayDate } from '../utils/checklistHistoryOptions';
import Modal from './Modal';

interface StoreComparisonDetailModalProps {
  store: StoreOperationsSummary | null;
  onClose: () => void;
}

function completionTone(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return '#d97706';
  return '#dc2626';
}

function StoreComparisonDetailModal({ store, onClose }: StoreComparisonDetailModalProps) {
  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getChecklistHistoryDetail(store.storeId, todayDate())
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [store]);

  const categoryRows = detail?.categories.map((cat) => {
    const total = cat.tasks.length;
    const completed = cat.tasks.filter((t) => t.completed).length;
    return { id: cat.id, name: cat.name, completed, total };
  }) ?? [];

  const pct = store?.completionPercent ?? 0;

  return (
    <Modal
      isOpen={store !== null}
      onClose={onClose}
      title={store?.storeName ?? ''}
      subtitle={store ? `Owner: ${store.ownerName}` : undefined}
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Overall completion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: completionTone(pct) }}>
            {pct}%
          </span>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Completion
            </div>
            {store && store.openIssues > 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', fontWeight: 600, marginTop: '2px' }}>
                {store.openIssues} open issue{store.openIssues !== 1 ? 's' : ''}
              </div>
            )}
            {store && store.openIssues === 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                No open issues
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        {loading && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Loading…</p>
        )}
        {error && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-accent)' }}>{error}</p>
        )}
        {!loading && !error && detail && !detail.hasChecklist && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            No checklist template for this store today.
          </p>
        )}
        {!loading && !error && categoryRows.length > 0 && (
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              Category Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {categoryRows.map((cat) => {
                const catPct = cat.total === 0 ? 0 : Math.round((cat.completed / cat.total) * 100);
                const done = cat.total > 0 && cat.completed === cat.total;
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </span>
                    {/* Progress bar */}
                    <div style={{ width: 80, flexShrink: 0, height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${catPct}%`, height: '100%', background: done ? '#16a34a' : '#3b82f6', borderRadius: 3, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: done ? '#16a34a' : 'var(--color-text-muted)', whiteSpace: 'nowrap', minWidth: 36, textAlign: 'right' }}>
                      {cat.completed}/{cat.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default StoreComparisonDetailModal;
