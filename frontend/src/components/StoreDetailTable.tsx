import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Flag, MoreVertical, Pencil } from 'lucide-react';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';
import { activeResponderCount, hasActiveResponse, MULTIPLE_COMPLETION_THRESHOLD, responseDisplayValue, taskFrequencyLabel, taskStatus, formatTimeLabel, formatDateLabel, TASK_STATUS_LABELS, type ChecklistTaskStatus } from '../utils/checklistHistoryOptions';
import { useIsMobile } from '../hooks/useMediaQuery';
import useDismissablePanel from '../hooks/useDismissablePanel';
import CorrectionModal from './CorrectionModal';
import FlagResponseModal from './FlagResponseModal';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './StoreDetailTable.css';

export interface StoreDetailRow {
  key: string;
  categoryName: string;
  task: ChecklistHistoryTaskItem;
  // Set only when this table is showing a multi-day range (e.g. "Last Week")
  // so rows for the same recurring task across different days stay
  // distinguishable instead of looking like one merged/duplicated row.
  dateLabel?: string;
}

interface StoreDetailTableProps {
  rows: StoreDetailRow[];
  isLoading?: boolean;
  hasChecklist: boolean;
  onResponseCorrected?: (taskId: number, updatedResponse: ChecklistHistoryResponseEntry) => void;
  onResponseFlagged?: (taskId: number, updatedResponse: ChecklistHistoryResponseEntry) => void;
  repeatOffenderMap?: Map<number, number>;
  // Distinguishes row ids when this table is rendered more than once on the
  // same page (e.g. Outstanding Tasks above the main table) -- a task can
  // appear in both, and duplicate DOM ids break getElementById-based scrolling.
  idPrefix?: string;
  // Mobile-only card layout to use ('history' = the main/day-history table,
  // 'outstanding' = the Outstanding/Incomplete Tasks panel). Purely a
  // presentational switch -- desktop/tablet render identically either way.
  variant?: 'history' | 'outstanding';
}

const STATUS_BADGE_CLASS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'badge--outline',
  COMPLETE: 'badge--success',
  ISSUE: 'badge--danger',
};

// A MULTIPLE-completion task with exactly one response is technically still
// OPEN (taskStatus() needs a second distinct responder to call it COMPLETE),
// but it already has an active response so it stays out of Outstanding and
// shows in this table -- displaying it as a plain "Open" pill there reads as
// nobody has responded yet, which is wrong. Display-only relabel, applied
// consistently to the status pill, the response value box and the mobile
// card's left border so none of them fall back to the muted "open" grey.
function isInProgressDisplay(task: ChecklistHistoryTaskItem, status: ChecklistTaskStatus): boolean {
  return status === 'OPEN' && hasActiveResponse(task);
}

function statusPillLabel(task: ChecklistHistoryTaskItem, status: ChecklistTaskStatus): string {
  if (isInProgressDisplay(task, status)) return 'In Progress';
  return TASK_STATUS_LABELS[status];
}

function statusPillClass(task: ChecklistHistoryTaskItem, status: ChecklistTaskStatus): string {
  if (isInProgressDisplay(task, status)) return 'badge--warning';
  return STATUS_BADGE_CLASS[status];
}

// Matches statusPillClass's suffix, but as the kebab-case token
// store-detail-table__response-value--<suffix> expects.
function responseValueSuffix(task: ChecklistHistoryTaskItem, status: ChecklistTaskStatus): string {
  return isInProgressDisplay(task, status) ? 'in-progress' : status.toLowerCase();
}

interface ResponseTarget {
  responseEntry: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
}

// Shared open/close wiring for the "Corrected" and "History" detail popovers:
// desktop/tablet reveal on hover or keyboard focus; mobile has no real hover,
// so it toggles on tap instead. The popover is rendered in a portal (see
// BadgePopover below), so it's no longer a DOM descendant of the trigger --
// hover state is tracked separately for the trigger and the popover itself
// (`open` is true while either is hovered) so moving the pointer from the
// badge into the popover doesn't close it.
function useDisclosure(isMobile: boolean) {
  const [hoverTrigger, setHoverTrigger] = useState(false);
  const [hoverPopover, setHoverPopover] = useState(false);
  const [tapOpen, setTapOpen] = useState(false);
  const open = isMobile ? tapOpen : hoverTrigger || hoverPopover;

  const triggerHandlers = isMobile
    ? { onClick: () => setTapOpen((current) => !current) }
    : {
        onMouseEnter: () => setHoverTrigger(true),
        onMouseLeave: () => setHoverTrigger(false),
        onFocus: () => setHoverTrigger(true),
        onBlur: () => setHoverTrigger(false),
      };
  const popoverHandlers = isMobile
    ? {}
    : { onMouseEnter: () => setHoverPopover(true), onMouseLeave: () => setHoverPopover(false) };

  return { open, triggerHandlers, popoverHandlers };
}

const POPOVER_GAP = 8;
const POPOVER_MARGIN = 8;
const POPOVER_DEFAULT_WIDTH = 260;

function computePopoverPosition(anchorRect: DOMRect, width: number, height: number) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceRight = viewportWidth - anchorRect.right - POPOVER_GAP;
  const spaceLeft = anchorRect.left - POPOVER_GAP;
  let left: number;
  if (spaceRight >= width) {
    left = anchorRect.right + POPOVER_GAP;
  } else if (spaceLeft >= width) {
    left = anchorRect.left - width - POPOVER_GAP;
  } else {
    // Neither side has room (narrow viewport) -- fall back to directly under the badge.
    left = anchorRect.left;
  }
  left = Math.max(POPOVER_MARGIN, Math.min(left, viewportWidth - width - POPOVER_MARGIN));

  let top = anchorRect.top;
  top = Math.min(top, viewportHeight - height - POPOVER_MARGIN);
  top = Math.max(POPOVER_MARGIN, top);

  return { top, left };
}

// Renders a popover beside its trigger via a `document.body` portal, so it
// escapes the table's scroll/overflow clipping and any ancestor stacking
// context entirely (the table sits inside `.table-scroll`, whose
// `overflow-x: auto` also clips `overflow-y` per the CSS spec, and on mobile
// each row's card can otherwise paint over an absolutely-positioned popover
// from an earlier row). Position is computed from the trigger's own bounding
// rect after the popover has mounted (still before paint) so its real size is
// known -- placed directly beside the badge (right, or left if there's no
// room) and vertically aligned with it, then clamped on both axes so it can
// never render outside the viewport.
function BadgePopover({
  open,
  anchorRef,
  popoverHandlers,
  className,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  popoverHandlers: { onMouseEnter?: () => void; onMouseLeave?: () => void };
  className: string;
  children: React.ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    if (!anchorRect) return;
    const width = popoverRef.current?.offsetWidth ?? POPOVER_DEFAULT_WIDTH;
    const height = popoverRef.current?.offsetHeight ?? 0;
    setPosition(computePopoverPosition(anchorRect, width, height));
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={className}
      role="tooltip"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
      {...popoverHandlers}
    >
      {children}
    </div>,
    document.body,
  );
}

function CorrectedBadge({ responseEntry, task }: { responseEntry: ChecklistHistoryResponseEntry; task: ChecklistHistoryTaskItem }) {
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, triggerHandlers, popoverHandlers } = useDisclosure(isMobile);
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
    <span className="store-detail-table__corrected-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="store-detail-table__corrected-badge"
        {...triggerHandlers}
        aria-expanded={open}
        aria-label="Correction details"
      >
        Corrected
      </button>
      <BadgePopover
        open={open}
        anchorRef={triggerRef}
        popoverHandlers={popoverHandlers}
        className="store-detail-table__correction-popover"
      >
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
      </BadgePopover>
    </span>
  );
}

const ROW_MENU_WIDTH = 190;
const ROW_MENU_MARGIN = 8;

// Mobile-only ("outstanding" variant): collapses the Correct/Flag actions
// that are otherwise always-visible icons (see renderManagerActions below)
// into a single "⋮" trigger, matching the compact card design for the
// Outstanding/Incomplete Tasks list. Same underlying handlers either way.
function TaskRowMenu({ onCorrect, onFlag }: { onCorrect?: () => void; onFlag?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.max(
        ROW_MENU_MARGIN,
        Math.min(rect.right - ROW_MENU_WIDTH, window.innerWidth - ROW_MENU_WIDTH - ROW_MENU_MARGIN),
      );
      setPosition({ top: rect.bottom + 4, left });
    }
    setIsOpen(true);
  }

  useDismissablePanel({ isOpen, onClose: () => setIsOpen(false), refs: [triggerRef, panelRef] });

  if (!onCorrect && !onFlag) return null;

  return (
    <span className="store-detail-table__row-menu">
      <button
        ref={triggerRef}
        type="button"
        className="store-detail-table__row-menu-trigger"
        aria-label="Task actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
      >
        <MoreVertical size={16} />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="store-detail-table__row-menu-panel"
            role="menu"
            style={{ top: position.top, left: position.left, width: ROW_MENU_WIDTH }}
          >
            {onCorrect && (
              <button
                type="button"
                role="menuitem"
                className="store-detail-table__row-menu-item"
                onClick={() => {
                  setIsOpen(false);
                  onCorrect();
                }}
              >
                <Pencil size={13} />
                Correct response
              </button>
            )}
            {onFlag && (
              <button
                type="button"
                role="menuitem"
                className="store-detail-table__row-menu-item"
                onClick={() => {
                  setIsOpen(false);
                  onFlag();
                }}
              >
                <Flag size={13} />
                Flag for correction
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

function StoreDetailTable({ rows, isLoading = false, hasChecklist, onResponseCorrected, onResponseFlagged, repeatOffenderMap, idPrefix = '', variant = 'history' }: StoreDetailTableProps) {
  const [correctionTarget, setCorrectionTarget] = useState<ResponseTarget | null>(null);
  const [flagTarget, setFlagTarget] = useState<ResponseTarget | null>(null);

  // Shared by the mobile inline-actions cell and the desktop Manager Actions
  // cell: badges (Flagged/Corrected) sit in a fixed-width slot ahead of the
  // edit/flag icons so the icons land at the same x position on every row,
  // whether a row has zero or one badge.
  function renderManagerActions(responder: ChecklistHistoryResponseEntry, task: ChecklistHistoryTaskItem) {
    return (
      <>
        <span className="store-detail-table__badges">
          {responder.flaggedNeedsCorrection && (
            <span className="store-detail-table__flagged-badge" title={responder.flagReason ?? 'Flagged for correction'}>
              Flagged
            </span>
          )}
          {responder.latestCorrection && !responder.flaggedNeedsCorrection && (
            <CorrectedBadge responseEntry={responder} task={task} />
          )}
        </span>
        <span className="store-detail-table__action-icons">
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
        </span>
      </>
    );
  }

  return (
    <>
      <div className={`table-card store-detail-table__card${variant === 'outstanding' ? ' store-detail-table__card--outstanding' : ''}`}>
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
              {rows.map(({ key, categoryName, task, dateLabel }) => {
                const status = taskStatus(task);
                const responders = task.responses;
                // Matches taskStatus/responseDisplayValue's own "latest response"
                // semantics, so the row-level Correct/Flag menu (outstanding
                // variant) acts on the same response the card's Response/Employee
                // values are actually showing.
                const primaryResponder = responders.length > 0 ? responders[responders.length - 1] : null;
                return (
                  <tr key={key} id={`${idPrefix}task-row-${key}`}>
                    <td data-label="Category" className="store-detail-table__category">
                      {categoryName}
                      <span className="store-detail-table__category-meta">
                        {' '}
                        · {taskFrequencyLabel(task)}
                        {dateLabel ? ` · ${dateLabel}` : ''}
                      </span>
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
                      <span className={`store-detail-table__response-value store-detail-table__response-value--${responseValueSuffix(task, status)}`}>
                        {status === 'COMPLETE' && (
                          <span className="store-detail-table__response-icon" aria-hidden="true">
                            <CheckCircle2 size={12} />
                          </span>
                        )}
                        {responseDisplayValue(task)}
                      </span>
                      {task.completionType === 'MULTIPLE' && (
                        <span className="store-detail-table__response-responder-count">
                          {activeResponderCount(task)}/{MULTIPLE_COMPLETION_THRESHOLD} responded
                        </span>
                      )}
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
                              {renderManagerActions(responder, task)}
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
                            {renderManagerActions(responder, task)}
                          </div>
                        ))
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label="Status" className="store-detail-table__status-cell">
                      <span className={`badge ${statusPillClass(task, status)}`}>{statusPillLabel(task, status)}</span>
                      {variant === 'outstanding' && primaryResponder && !primaryResponder.flaggedNeedsCorrection && (
                        <TaskRowMenu
                          onCorrect={onResponseCorrected ? () => setCorrectionTarget({ responseEntry: primaryResponder, task }) : undefined}
                          onFlag={onResponseFlagged ? () => setFlagTarget({ responseEntry: primaryResponder, task }) : undefined}
                        />
                      )}
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
