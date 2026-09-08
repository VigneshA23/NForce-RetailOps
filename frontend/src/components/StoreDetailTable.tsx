import { useLayoutEffect, useRef, useState } from 'react';
import { Flag, History as HistoryIcon, Pencil } from 'lucide-react';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';
import { responseDisplayValue, taskFrequencyLabel, taskStatus, formatTimeLabel, formatDateLabel, type ChecklistTaskStatus } from '../utils/checklistHistoryOptions';
import { useIsMobile } from '../hooks/useMediaQuery';
import CorrectionModal from './CorrectionModal';
import FlagResponseModal from './FlagResponseModal';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './StoreDetailTable.css';

export interface StoreDetailRow {
  key: string;
  categoryName: string;
  task: ChecklistHistoryTaskItem;
}

interface StoreDetailTableProps {
  rows: StoreDetailRow[];
  isLoading?: boolean;
  hasChecklist: boolean;
  onResponseCorrected?: (taskId: number, updatedResponse: ChecklistHistoryResponseEntry) => void;
  onResponseFlagged?: (taskId: number, updatedResponse: ChecklistHistoryResponseEntry) => void;
  repeatOffenderMap?: Map<number, number>;
}

const STATUS_LABELS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'Open',
  COMPLETE: 'Complete',
  ISSUE: 'Issue',
};

const STATUS_BADGE_CLASS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'badge--outline',
  COMPLETE: 'badge--success',
  ISSUE: 'badge--danger',
};

interface ResponseTarget {
  responseEntry: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
}

// Shared open/close wiring for the "Corrected" and "History" detail popovers:
// desktop/tablet reveal on hover (mouse over the wrapping span, which also
// covers the popover itself so moving the pointer into it doesn't close it) or
// keyboard focus; mobile has no real hover, so it toggles on tap instead.
// `onShow` runs right before the popover opens (e.g. to compute its position).
function useDisclosure(isMobile: boolean, onShow?: () => void) {
  const [open, setOpen] = useState(false);
  function show() {
    onShow?.();
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }
  const wrapHandlers = isMobile ? {} : { onMouseEnter: show, onMouseLeave: hide };
  const triggerHandlers = isMobile ? { onClick: () => (open ? hide() : show()) } : { onFocus: show, onBlur: hide };
  return { open, wrapHandlers, triggerHandlers };
}

function CorrectedBadge({ responseEntry, task }: { responseEntry: ChecklistHistoryResponseEntry; task: ChecklistHistoryTaskItem }) {
  const isMobile = useIsMobile();
  const { open, wrapHandlers, triggerHandlers } = useDisclosure(isMobile);
  const c = responseEntry.latestCorrection!;
  const correctedAt = `${formatDateLabel(c.correctedAt.slice(0, 10))} ${formatTimeLabel(c.correctedAt)}`;

  const originalVal =
    c.originalValueBoolean !== null
      ? task.responseType === 'YES_NO'
        ? c.originalValueBoolean ? 'Yes' : 'No'
        : c.originalValueBoolean ? 'Done' : 'Not done'
      : c.originalValueNumeric !== null
        ? task.numericUnit ? `${c.originalValueNumeric} ${task.numericUnit}` : String(c.originalValueNumeric)
        : (c.originalValueText ?? '—');

  const correctedVal =
    c.correctedValueBoolean !== null
      ? task.responseType === 'YES_NO'
        ? c.correctedValueBoolean ? 'Yes' : 'No'
        : c.correctedValueBoolean ? 'Done' : 'Not done'
      : c.correctedValueNumeric !== null
        ? task.numericUnit ? `${c.correctedValueNumeric} ${task.numericUnit}` : String(c.correctedValueNumeric)
        : (c.correctedValueText ?? '—');

  return (
    <span className="store-detail-table__corrected-wrap" {...wrapHandlers}>
      <button
        type="button"
        className="store-detail-table__corrected-badge"
        {...triggerHandlers}
        aria-expanded={open}
        aria-label="Correction details"
      >
        Corrected
      </button>
      {open && (
        <span className="store-detail-table__correction-popover">
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">By</span>
            {c.correctedByFullName}
          </span>
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">When</span>
            {correctedAt}
          </span>
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">Change</span>
            {originalVal} → {correctedVal}
          </span>
          {c.reason && (
            <span className="store-detail-table__correction-popover-row">
              <span className="store-detail-table__correction-popover-label">Reason</span>
              <em>{c.reason}</em>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

interface HistoryValueLike {
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
}

function formatHistoryValue(entry: HistoryValueLike, task: ChecklistHistoryTaskItem): string {
  if (entry.booleanValue !== null) {
    if (task.responseType === 'YES_NO') return entry.booleanValue ? 'Yes' : 'No';
    return entry.booleanValue ? 'Done' : 'Not done';
  }
  if (entry.numericValue !== null) {
    return task.numericUnit ? `${entry.numericValue} ${task.numericUnit}` : String(entry.numericValue);
  }
  if (entry.textValue !== null && entry.textValue !== '') return entry.textValue;
  return '—';
}

// Width the popover renders at (matches the CSS class) -- the horizontal
// clamp/flip logic below needs this before the popover has actually rendered
// (its very first open), and falls back to its own measured offsetWidth once
// it has.
const HISTORY_POPOVER_WIDTH = 260;
const HISTORY_POPOVER_MARGIN = 12;
const HISTORY_POPOVER_GAP = 8;

// "History" badge — shown once a response has been through at least one
// flag -> resubmit cycle (StoreDetailTable.resubmissionHistory), independent of
// whether it's currently flagged again or already resubmitted. Desktop/tablet:
// hover/focus. Mobile: tap (see useDisclosure). Positioned with `position:
// fixed` (not the usual `position: absolute`) from the trigger's own bounding
// rect -- the table sits inside a horizontally scrolling container
// (`.table-scroll`), whose `overflow-x: auto` also clips `overflow-y` per the
// CSS spec, so an absolutely-positioned popover here would get cut off by
// that ancestor instead of showing in full.
function ResubmissionHistoryBadge({ responseEntry, task }: { responseEntry: ChecklistHistoryResponseEntry; task: ChecklistHistoryTaskItem }) {
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const { open, wrapHandlers, triggerHandlers } = useDisclosure(isMobile);
  const history = responseEntry.resubmissionHistory;

  // Runs after the popover has mounted (still before paint) so its real
  // rendered size is known -- placed directly beside the badge (to the right,
  // or the left if there's no room), vertically aligned with it, and then
  // clamped on both axes so it can never render outside the viewport.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    const popoverWidth = popoverRef.current?.offsetWidth ?? HISTORY_POPOVER_WIDTH;
    const popoverHeight = popoverRef.current?.offsetHeight ?? 0;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceRight = viewportWidth - triggerRect.right - HISTORY_POPOVER_GAP;
    const spaceLeft = triggerRect.left - HISTORY_POPOVER_GAP;
    let left: number;
    if (spaceRight >= popoverWidth) {
      left = triggerRect.right + HISTORY_POPOVER_GAP;
    } else if (spaceLeft >= popoverWidth) {
      left = triggerRect.left - popoverWidth - HISTORY_POPOVER_GAP;
    } else {
      // Neither side has room (narrow viewport) -- center it under the badge instead.
      left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    }
    left = Math.max(HISTORY_POPOVER_MARGIN, Math.min(left, viewportWidth - popoverWidth - HISTORY_POPOVER_MARGIN));

    let top = triggerRect.top;
    top = Math.min(top, viewportHeight - popoverHeight - HISTORY_POPOVER_MARGIN);
    top = Math.max(HISTORY_POPOVER_MARGIN, top);

    // `position: fixed` is normally viewport-relative, but any ancestor with
    // `transform`/`filter`/`will-change: transform` (etc.) hijacks it into
    // being relative to THAT ancestor instead (this app's page-transition
    // wrapper, .app-shell__page, sets `will-change: opacity, transform`
    // permanently) -- offsetParent already tells us which element is actually
    // acting as the containing block, so the viewport-relative coordinates
    // above are converted into that element's coordinate space before being
    // applied. When nothing hijacks it, offsetParent is null and this is a
    // no-op (subtracting {0, 0}).
    const containingBlock = popoverRef.current?.offsetParent?.getBoundingClientRect();
    setPosition({
      top: top - (containingBlock?.top ?? 0),
      left: left - (containingBlock?.left ?? 0),
    });
  }, [open]);

  return (
    <span className="store-detail-table__corrected-wrap" {...wrapHandlers}>
      <button
        ref={triggerRef}
        type="button"
        className="store-detail-table__history-badge"
        {...triggerHandlers}
        aria-expanded={open}
        aria-label="View resubmission history"
      >
        <HistoryIcon size={10} />
        History
      </button>
      {open && (
        <span
          ref={popoverRef}
          className="store-detail-table__history-popover"
          role="tooltip"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          {history.map((hop, index) => {
            const next = index + 1 < history.length ? history[index + 1] : responseEntry;
            const nextRespondedAt = index + 1 < history.length ? history[index + 1].respondedAt : responseEntry.respondedAt;
            const nextEmployeeName = index + 1 < history.length ? history[index + 1].employeeFullName : responseEntry.employeeFullName;
            return (
              <span key={hop.responseId} className="store-detail-table__history-hop">
                <span className="store-detail-table__correction-popover-row">
                  <span className="store-detail-table__correction-popover-label">Change</span>
                  {formatHistoryValue(hop, task)} → {formatHistoryValue(next, task)}
                </span>
                <span className="store-detail-table__correction-popover-row">
                  <span className="store-detail-table__correction-popover-label">Flagged</span>
                  {hop.flaggedByName ?? 'Owner'}
                  {hop.flaggedAt ? ` · ${formatDateLabel(hop.flaggedAt.slice(0, 10))} ${formatTimeLabel(hop.flaggedAt)}` : ''}
                </span>
                {hop.flagReason && (
                  <span className="store-detail-table__correction-popover-row">
                    <span className="store-detail-table__correction-popover-label">Reason</span>
                    <em>{hop.flagReason}</em>
                  </span>
                )}
                <span className="store-detail-table__correction-popover-row">
                  <span className="store-detail-table__correction-popover-label">Resubmitted</span>
                  {nextEmployeeName} · {formatDateLabel(nextRespondedAt.slice(0, 10))} {formatTimeLabel(nextRespondedAt)}
                </span>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

function StoreDetailTable({ rows, isLoading = false, hasChecklist, onResponseCorrected, onResponseFlagged, repeatOffenderMap }: StoreDetailTableProps) {
  const [correctionTarget, setCorrectionTarget] = useState<ResponseTarget | null>(null);
  const [flagTarget, setFlagTarget] = useState<ResponseTarget | null>(null);

  return (
    <>
      <div className="table-card store-detail-table__card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Task</th>
                <th scope="col">Response</th>
                <th scope="col">Employee</th>
                <th scope="col" className="store-detail-table__actions-cell">Manager Actions</th>
                <th scope="col" className="store-detail-table__status-cell">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, categoryName, task }) => {
                const status = taskStatus(task);
                const responders = task.responses;
                return (
                  <tr key={key} id={`task-row-${key}`}>
                    <td data-label="Category" className="store-detail-table__category">
                      {categoryName}
                    </td>
                    <td data-label="Task">
                      <span className="store-detail-table__task-name">
                        {task.name}
                        {(repeatOffenderMap?.get(task.id) ?? 0) >= 3 && (
                          <span
                            className="store-detail-table__repeat-dot"
                            title={`This task has been open ${repeatOffenderMap!.get(task.id)} of the last 7 days`}
                            aria-label={`This task has been open ${repeatOffenderMap!.get(task.id)} of the last 7 days`}
                          />
                        )}
                      </span>
                      <span className="store-detail-table__task-meta">{taskFrequencyLabel(task)}</span>
                    </td>
                    <td
                      data-label="Response"
                      className={status === 'ISSUE' ? 'store-detail-table__response--issue' : undefined}
                    >
                      {responseDisplayValue(task)}
                    </td>
                    <td data-label="Employee">
                      {responders.length > 0 ? (
                        <div className="store-detail-table__responders-list">
                        {responders.map((responder) => (
                          <div key={responder.id} className="store-detail-table__employee-entry">
                            <span className="store-detail-table__employee-line">
                              <UserAvatar initials={getInitials(responder.employeeFullName)} src={responder.employeeAvatarUrl} size={20} />
                              <span className="store-detail-table__employee-name">
                                {responder.employeeFullName}
                                <span className="store-detail-table__response-time"> · {formatTimeLabel(responder.respondedAt)}</span>
                              </span>
                            </span>
                            {/* Mobile-only: action buttons inline with each responder */}
                            <div className="store-detail-table__inline-actions">
                              {responder.flaggedNeedsCorrection && (
                                <span className="store-detail-table__flagged-badge" title={responder.flagReason ?? 'Flagged for correction'}>
                                  Flagged
                                </span>
                              )}
                              {responder.latestCorrection && !responder.flaggedNeedsCorrection && (
                                <CorrectedBadge responseEntry={responder} task={task} />
                              )}
                              {responder.resubmissionHistory.length > 0 && (
                                <ResubmissionHistoryBadge responseEntry={responder} task={task} />
                              )}
                              {onResponseCorrected && !responder.flaggedNeedsCorrection && (
                                <button
                                  type="button"
                                  className="store-detail-table__correct-btn"
                                  onClick={() => setCorrectionTarget({ responseEntry: responder, task })}
                                  aria-label="Correct this response"
                                  title="Correct this response"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                              {onResponseFlagged && !responder.flaggedNeedsCorrection && (
                                <button
                                  type="button"
                                  className="store-detail-table__correct-btn store-detail-table__flag-btn"
                                  onClick={() => setFlagTarget({ responseEntry: responder, task })}
                                  aria-label="Flag this response for correction"
                                  title="Flag back to employee"
                                >
                                  <Flag size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label="Manager Actions" className="store-detail-table__actions-cell store-detail-table__desktop-actions">
                      {responders.length > 0 ? (
                        responders.map((responder) => (
                          <div key={responder.id} className="store-detail-table__actions-entry">
                            {responder.flaggedNeedsCorrection && (
                              <span className="store-detail-table__flagged-badge" title={responder.flagReason ?? 'Flagged for correction'}>
                                Flagged
                              </span>
                            )}
                            {responder.latestCorrection && !responder.flaggedNeedsCorrection && (
                              <CorrectedBadge responseEntry={responder} task={task} />
                            )}
                            {responder.resubmissionHistory.length > 0 && (
                              <ResubmissionHistoryBadge responseEntry={responder} task={task} />
                            )}
                            {onResponseCorrected && !responder.flaggedNeedsCorrection && (
                              <button
                                type="button"
                                className="store-detail-table__correct-btn"
                                onClick={() => setCorrectionTarget({ responseEntry: responder, task })}
                                aria-label="Correct this response"
                                title="Correct this response"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {onResponseFlagged && !responder.flaggedNeedsCorrection && (
                              <button
                                type="button"
                                className="store-detail-table__correct-btn store-detail-table__flag-btn"
                                onClick={() => setFlagTarget({ responseEntry: responder, task })}
                                aria-label="Flag this response for correction"
                                title="Flag back to employee"
                              >
                                <Flag size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label="Status" className="store-detail-table__status-cell">
                      <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && rows.length === 0 && (
          <div className="table-card__empty">
            {hasChecklist
              ? 'No tasks match the selected filter.'
              : 'No checklist template was in effect for this store on this day.'}
          </div>
        )}
        {isLoading && <div className="table-card__empty">Loading checklist…</div>}
      </div>

      {correctionTarget && (
        <CorrectionModal
          isOpen={correctionTarget !== null}
          onClose={() => setCorrectionTarget(null)}
          responseEntry={correctionTarget.responseEntry}
          task={correctionTarget.task}
          onSaved={(updatedResponse) => {
            onResponseCorrected?.(correctionTarget.task.id, updatedResponse);
            setCorrectionTarget(null);
          }}
        />
      )}
      {flagTarget && (
        <FlagResponseModal
          isOpen={flagTarget !== null}
          onClose={() => setFlagTarget(null)}
          responseEntry={flagTarget.responseEntry}
          task={flagTarget.task}
          onFlagged={(updatedResponse) => {
            onResponseFlagged?.(flagTarget.task.id, updatedResponse);
            setFlagTarget(null);
          }}
        />
      )}
    </>
  );
}

export default StoreDetailTable;
