import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle, ArrowUpRight, Bell, Check, CheckCheck,
  ChevronLeft, Inbox, Loader2,
  RefreshCw, Search, Trash2,
} from 'lucide-react';
import { deleteNotification, getNotifications, getUnreadCount, markAllRead, markNotificationRead } from '../api/notifications';
import type { Notification } from '../types/notification';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { ALL_DISPLAY_CATEGORIES, getCategoryMeta, type DisplayCategory } from '../utils/notificationCategoryMeta';
import './Notifications.css';

// ── Display metadata per notification category ────────────────────────────────
// Icon/color/displayCategory lookup lives in utils/notificationCategoryMeta.ts,
// shared with NotificationBell so the two surfaces stay in sync.

const getMeta = getCategoryMeta;

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

function getPriority(n: Notification): Priority {
  const p = n.priority as Priority;
  if (p === 'HIGH' || p === 'MEDIUM' || p === 'LOW') return p;
  return 'MEDIUM';
}

const PRIORITY_META: Record<Priority, { label: string; colorVar: string; bgVar: string }> = {
  HIGH:   { label: 'High',   colorVar: '--color-badge-icon-primary-fg', bgVar: '--color-badge-icon-primary-bg' },
  MEDIUM: { label: 'Medium', colorVar: '--color-badge-icon-warning-fg', bgVar: '--color-badge-icon-warning-bg' },
  LOW:    { label: 'Low',    colorVar: '--color-text-muted',            bgVar: '--color-border' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr():     string { return toLocalDate(new Date().toISOString()); }
function yesterdayStr(): string { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDate(d.toISOString()); }
function weekStartStr(): string { const d = new Date(); d.setDate(d.getDate() - 6); return toLocalDate(d.toISOString()); }

function groupLabel(iso: string): string {
  const date = toLocalDate(iso);
  if (date === todayStr())     return 'Today';
  if (date === yesterdayStr()) return 'Yesterday';
  if (date >= weekStartStr())  return 'Earlier this week';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Older'];

function groupNotifications(list: Notification[]): { label: string; items: Notification[] }[] {
  const map = new Map<string, Notification[]>();
  for (const n of list) {
    const label = groupLabel(n.createdAt);
    const bucket = map.get(label) ?? [];
    bucket.push(n);
    map.set(label, bucket);
  }
  return GROUP_ORDER.filter(g => map.has(g)).map(l => ({ label: l, items: map.get(l)! }));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Pill badge ────────────────────────────────────────────────────────────────

function Pill({ colorVar, bgVar, children }: { colorVar: string; bgVar: string; children: ReactNode }) {
  return (
    <span className="nfp-pill" style={{ color: `var(${colorVar})`, background: `var(${bgVar})` }}>
      {children}
    </span>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="nfp-skeleton-row">
      <div className="nfp-skeleton nfp-skeleton--icon" />
      <div className="nfp-skeleton-body">
        <div className="nfp-skeleton nfp-skeleton--title" />
        <div className="nfp-skeleton nfp-skeleton--sub" />
        <div className="nfp-skeleton-badges">
          <div className="nfp-skeleton nfp-skeleton--badge" />
          <div className="nfp-skeleton nfp-skeleton--badge-sm" />
        </div>
      </div>
    </div>
  );
}

// ── Swipeable row (mobile delete gesture) ─────────────────────────────────────

const SWIPE_SNAP = 72;
const SWIPE_THRESHOLD = 36;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  deleting: boolean;
  onOpen: (closeFn: () => void) => void;
}

function SwipeableRow({ children, onDelete, deleting, onOpen }: SwipeableRowProps) {
  const innerRef             = useRef<HTMLDivElement>(null);
  const startClientX         = useRef(0);
  const startClientY         = useRef(0);
  const startAbsX            = useRef(0);
  const gestureKind          = useRef<'unknown' | 'swipe' | 'scroll'>('unknown');
  const isOpen               = useRef(false);
  // True when the panel was already open at the start of the current gesture.
  // Used in the capture handler to decide whether to close after suppressing
  // a ghost click.
  const wasOpenAtGestureStart = useRef(false);
  const suppressClick         = useRef(false);

  function applyTransform(x: number, animated: boolean) {
    if (!innerRef.current) return;
    innerRef.current.style.transition = animated ? 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
    innerRef.current.style.transform  = x === 0 ? '' : `translateX(${x}px)`;
  }

  function close() {
    applyTransform(0, true);
    isOpen.current = false;
  }

  function open() {
    onOpen(close);
    applyTransform(-SWIPE_SNAP, true);
    isOpen.current = true;
  }

  function onTouchStart(e: React.TouchEvent) {
    startClientX.current        = e.touches[0].clientX;
    startClientY.current        = e.touches[0].clientY;
    startAbsX.current           = isOpen.current ? -SWIPE_SNAP : 0;
    gestureKind.current         = 'unknown';
    wasOpenAtGestureStart.current = isOpen.current;
    if (innerRef.current) innerRef.current.style.transition = 'none';
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startClientX.current;
    const dy = e.touches[0].clientY - startClientY.current;
    if (gestureKind.current === 'unknown') {
      if (Math.abs(dy) > Math.abs(dx) + 3) { gestureKind.current = 'scroll'; return; }
      if (Math.abs(dx) < 5) return;
      gestureKind.current = 'swipe';
    }
    if (gestureKind.current !== 'swipe') return;
    const absX = Math.max(-SWIPE_SNAP, Math.min(0, startAbsX.current + dx));
    if (innerRef.current) {
      innerRef.current.style.transform = absX === 0 ? '' : `translateX(${absX}px)`;
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (gestureKind.current === 'scroll') return;
    const dx   = e.changedTouches[0].clientX - startClientX.current;
    const absX = Math.max(-SWIPE_SNAP, Math.min(0, startAbsX.current + dx));

    if (gestureKind.current === 'swipe' || isOpen.current) {
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 400);
    }

    if (!isOpen.current && absX < -SWIPE_THRESHOLD)                  open();
    else if (isOpen.current && absX > -SWIPE_SNAP + SWIPE_THRESHOLD) close();
    else if (!isOpen.current)                                         applyTransform(0, true);
    else                                                              applyTransform(-SWIPE_SNAP, true);
  }

  // Capture phase runs before any child onClick — this is how we prevent
  // the ghost click (or a tap on an open row) from triggering navigation
  // inside NotifRow. Wrapper-level onClick fires too late (child already ran).
  function onInnerClickCapture(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick.current = false;
      if (wasOpenAtGestureStart.current) close();
      return;
    }
    if (isOpen.current) {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  }

  return (
    <div
      className="nfp-swipe-wrapper"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div ref={innerRef} className="nfp-swipe-inner" onClickCapture={onInnerClickCapture}>
        {children}
      </div>
      <button
        type="button"
        className="nfp-swipe-delete"
        aria-label="Delete notification"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
      >
        {deleting ? <Loader2 size={18} className="nfp-spin" /> : <Trash2 size={18} />}
      </button>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

interface NotifRowProps {
  n: Notification;
  selected: boolean;
  onSelect: (n: Notification) => void;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  markingId: number | null;
  deletingId: number | null;
}

function NotifRow({ n, selected, onSelect, onMarkRead, onDelete, markingId, deletingId }: NotifRowProps) {
  const meta = getMeta(n.category);
  const pri  = getPriority(n);
  const pm   = PRIORITY_META[pri];
  const Icon = meta.icon;

  function handleMarkReadBtn(e: React.MouseEvent) {
    e.stopPropagation();
    if (!n.read && markingId === null) onMarkRead(n.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'nfp-row',
        !n.read ? 'nfp-row--unread' : '',
        selected ? 'nfp-row--selected' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(n)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); } }}
    >
      <div
        className="nfp-row__icon"
        style={{ background: `var(${meta.bgVar})`, color: `var(${meta.fgVar})` }}
        aria-hidden="true"
      >
        <Icon size={15} strokeWidth={2} />
      </div>

      <div className="nfp-row__body">
        <div className="nfp-row__top">
          <span className={`nfp-row__title${n.read ? ' nfp-row__title--read' : ''}`}>{n.title}</span>
          <span className="nfp-row__time">{timeAgo(n.createdAt)}</span>
        </div>
        {n.message && <p className="nfp-row__msg">{n.message}</p>}
        <div className="nfp-row__badges">
          <Pill colorVar={meta.fgVar} bgVar={meta.bgVar}>{meta.displayCategory}</Pill>
          <Pill colorVar={pm.colorVar} bgVar={pm.bgVar}>{pm.label}</Pill>
          {!n.read && <span className="nfp-row__dot" aria-hidden="true" />}
        </div>
      </div>

      {!n.read && (
        <button
          type="button"
          className="nfp-row__mark-btn"
          aria-label="Mark as read"
          title="Mark as read"
          onClick={handleMarkReadBtn}
        >
          {markingId === n.id
            ? <Loader2 size={10} className="nfp-spin" />
            : <Check size={10} />}
        </button>
      )}
      <button
        type="button"
        className="nfp-row__delete-btn"
        aria-label="Delete notification"
        title="Delete"
        onClick={e => { e.stopPropagation(); onDelete(n.id); }}
        disabled={deletingId === n.id}
      >
        {deletingId === n.id
          ? <Loader2 size={10} className="nfp-spin" />
          : <Trash2 size={10} />}
      </button>
    </div>
  );
}

// ── Detail pane ───────────────────────────────────────────────────────────────

interface DetailPaneProps {
  n: Notification | null;
  onNavigate?: (path: string, createdAt?: string) => void;
  onBack?: () => void;
  onDelete?: (id: number) => void;
  deletingId?: number | null;
}

function DetailPane({ n, onNavigate, onBack, onDelete, deletingId }: DetailPaneProps) {
  if (!n) {
    return (
      <div className="nfp-detail nfp-detail--empty">
        <div className="nfp-detail__placeholder">
          <div className="nfp-detail__placeholder-icon">
            <Inbox size={30} />
          </div>
          <p className="nfp-detail__placeholder-title">No notification selected</p>
          <p className="nfp-detail__placeholder-sub">
            Select a notification from the list to see full details here.
          </p>
        </div>
      </div>
    );
  }

  const meta = getMeta(n.category);
  const pri  = getPriority(n);
  const pm   = PRIORITY_META[pri];
  const Icon = meta.icon;

  return (
    <div className="nfp-detail">
      {onBack && (
        <button type="button" className="nfp-detail__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>
      )}

      <div className="nfp-detail__header-row">
        <div
          className="nfp-detail__icon"
          style={{ background: `var(${meta.bgVar})`, color: `var(${meta.fgVar})` }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2} />
        </div>
        <Pill colorVar={meta.fgVar} bgVar={meta.bgVar}>{meta.displayCategory}</Pill>
        <Pill colorVar={pm.colorVar} bgVar={pm.bgVar}>{pm.label} priority</Pill>
        <Pill
          colorVar={n.read ? '--color-text-muted' : '--color-badge-icon-primary-fg'}
          bgVar={n.read ? '--color-border' : '--color-badge-icon-primary-bg'}
        >
          {n.read ? 'Read' : 'Unread'}
        </Pill>
      </div>

      <h2 className="nfp-detail__title">{n.title}</h2>
      <p className="nfp-detail__ts">{new Date(n.createdAt).toLocaleString()}</p>
      <hr className="nfp-detail__divider" />
      <p className="nfp-detail__body">{n.message || 'No additional details provided.'}</p>

      <div className="nfp-detail__actions">
        {n.linkPath && onNavigate && (
          <button
            type="button"
            className="nfp-detail__open-btn"
            onClick={() => onNavigate(n.linkPath!, n.createdAt)}
          >
            Open related page <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="nfp-detail__delete-btn"
            onClick={() => onDelete(n.id)}
            disabled={deletingId === n.id}
          >
            {deletingId === n.id
              ? <Loader2 size={13} className="nfp-spin" />
              : <Trash2 size={13} />}
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'unread' | 'read';
type SortOrder = 'newest' | 'oldest';

interface NotificationsProps {
  onUnreadChange: (count: number) => void;
  onNavigate?: (path: string, createdAt?: string) => void;
  // Leaves the Notifications page entirely (e.g. back to Home) -- distinct
  // from DetailPane's own onBack, which just returns from the mobile detail
  // view to this page's list.
  onBackToHome?: () => void;
}

function Notifications({ onUnreadChange, onNavigate, onBackToHome }: NotificationsProps) {
  const isWide = useMediaQuery('(min-width: 900px)');
  const isDesktopPointer = useMediaQuery('(hover: hover) and (pointer: fine)');

  const [items, setItems]           = useState<Notification[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [fetching, setFetching]     = useState(false);
  const [marking, setMarking]       = useState(false);
  const [markingId, setMarkingId]   = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const closeActiveSwipe = useRef<(() => void) | null>(null);

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<DisplayCategory | 'all'>('all');
  const [priFilter, setPriFilter] = useState<Priority | 'all'>('all');
  const [statusFilter, setStatus] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Tracked separately from `items` because `items` is capped at the backend's
  // page size (100) -- for an account with more unread notifications than that,
  // items.filter(!read).length would understate the true unread total. This
  // mirrors the bell's own /notifications/unread-count-backed figure so the two
  // surfaces never disagree.
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Pagination: the backend caps a single page at PAGE_SIZE, so older
  // notifications beyond the first page are fetched on demand via "Load older".
  const PAGE_SIZE = 100;
  const [page, setPage]           = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function load(silent = false) {
    if (!silent) { setLoading(true); setError(false); }
    else setFetching(true);
    Promise.all([getNotifications(0, PAGE_SIZE), getUnreadCount()])
      .then(([data, count]) => {
        setItems(data);
        setUnreadTotal(count);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => { if (!silent) setError(true); })
      .finally(() => { setLoading(false); setFetching(false); });
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await getNotifications(nextPage, PAGE_SIZE);
      setItems(prev => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // Leave hasMore as-is so the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleMarkAll() {
    setMarking(true);
    await markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadTotal(0);
    onUnreadChange(0);
    setMarking(false);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await deleteNotification(id).catch(() => {});
    const target = items.find(n => n.id === id);
    setItems(prev => prev.filter(n => n.id !== id));
    if (target && !target.read) {
      onUnreadChange(-1);
      setUnreadTotal(prev => Math.max(0, prev - 1));
    }
    if (selectedId === id) {
      setSelectedId(null);
      if (!isWide) setShowDetail(false);
    }
    setDeletingId(null);
  }

  async function handleMarkRead(id: number) {
    const notif = items.find(n => n.id === id);
    if (!notif || notif.read) return;
    setMarkingId(id);
    await markNotificationRead(id).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    onUnreadChange(-1);
    setUnreadTotal(prev => Math.max(0, prev - 1));
    setMarkingId(null);
  }

  function handleSwipeOpen(closeFn: () => void) {
    closeActiveSwipe.current?.();
    closeActiveSwipe.current = closeFn;
  }

  function handleSelect(n: Notification) {
    closeActiveSwipe.current?.();
    closeActiveSwipe.current = null;
    setSelectedId(n.id);
    if (!n.read) handleMarkRead(n.id);
    if (!isWide) setShowDetail(true);
  }

  const visible = useMemo(() => {
    let list = items;
    if (statusFilter === 'unread') list = list.filter(n => !n.read);
    if (statusFilter === 'read')   list = list.filter(n => n.read);
    if (catFilter !== 'all')       list = list.filter(n => getMeta(n.category).displayCategory === catFilter);
    if (priFilter !== 'all')       list = list.filter(n => getPriority(n) === priFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.message ?? '').toLowerCase().includes(q) ||
        getMeta(n.category).displayCategory.toLowerCase().includes(q) ||
        PRIORITY_META[getPriority(n)].label.toLowerCase().includes(q),
      );
    }
    if (sortOrder === 'oldest') list = [...list].reverse();
    return list;
  }, [items, statusFilter, catFilter, priFilter, search, sortOrder]);

  const groups   = groupNotifications(visible);
  const selected = items.find(n => n.id === selectedId) ?? null;
  const unread   = unreadTotal;
  const total    = items.length;

  // Mobile detail view
  if (!isWide && showDetail) {
    return (
      <div className="nfp-page">
        <div className="nfp-mobile-detail-card">
          <DetailPane
            n={selected}
            onNavigate={(path, createdAt) => { onNavigate?.(path, createdAt); setShowDetail(false); }}
            onBack={() => setShowDetail(false)}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="nfp-page">

      {onBackToHome && (
        <button type="button" className="nfp-detail__back" onClick={onBackToHome}>
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>
      )}

      {/* ── Header ── */}
      <div className="nfp-header">
        <div>
          <h1 className="nfp-header__title">
            Notifications
            {unread > 0 && (
              <span className="nfp-header__unread-badge">{unread} unread</span>
            )}
          </h1>
          <p className="nfp-header__sub">
            {total > 0 ? `${total} total notification${total !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="nfp-header__actions">
          <button
            type="button"
            className="nfp-icon-btn"
            aria-label="Refresh notifications"
            title="Refresh"
            onClick={() => load(true)}
            disabled={fetching || loading}
          >
            <RefreshCw size={14} className={fetching ? 'nfp-spin' : undefined} />
          </button>
          {unread > 0 && (
            <button
              type="button"
              className="nfp-text-btn"
              onClick={handleMarkAll}
              disabled={marking}
            >
              {marking
                ? <Loader2 size={12} className="nfp-spin" />
                : <CheckCheck size={13} />}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="nfp-toolbar">
        <div className="nfp-toolbar__search">
          <Search size={13} className="nfp-toolbar__search-icon" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            aria-label="Search notifications"
            className="nfp-toolbar__search-input"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value as typeof catFilter)}
          aria-label="Filter by category"
          className="nfp-toolbar__select"
        >
          <option value="all">All categories</option>
          {ALL_DISPLAY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={priFilter}
          onChange={e => setPriFilter(e.target.value as typeof priFilter)}
          aria-label="Filter by priority"
          className="nfp-toolbar__select"
        >
          <option value="all">All priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by read status"
          className="nfp-toolbar__select"
        >
          <option value="all">All notifications</option>
          <option value="unread">Unread only</option>
          <option value="read">Read only</option>
        </select>
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort order"
          className="nfp-toolbar__select"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="nfp-body">
          <div className="nfp-list-pane">
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        </div>
      ) : error ? (
        <div className="nfp-error-state">
          <AlertCircle size={15} aria-hidden="true" />
          Failed to load notifications. Please refresh.
        </div>
      ) : items.length === 0 ? (
        <div className="nfp-empty-state">
          <div className="nfp-empty-state__icon">
            <Bell size={26} />
          </div>
          <p className="nfp-empty-state__title">You're all caught up</p>
          <p className="nfp-empty-state__sub">
            Issues, task updates, and account events will appear here.
          </p>
        </div>
      ) : (
        <div className="nfp-body">
          {/* List pane */}
          <div className="nfp-list-pane">
            {groups.length === 0 ? (
              <p className="nfp-no-match">No notifications match your filters.</p>
            ) : (
              groups.map(group => (
                <div key={group.label}>
                  <div className="nfp-group-label">{group.label}</div>
                  {group.items.map(n => isDesktopPointer ? (
                    <NotifRow
                      key={n.id}
                      n={n}
                      selected={n.id === selectedId}
                      onSelect={handleSelect}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                      markingId={markingId}
                      deletingId={deletingId}
                    />
                  ) : (
                    <SwipeableRow
                      key={n.id}
                      onDelete={() => handleDelete(n.id)}
                      deleting={deletingId === n.id}
                      onOpen={handleSwipeOpen}
                    >
                      <NotifRow
                        n={n}
                        selected={false}
                        onSelect={handleSelect}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                        markingId={markingId}
                        deletingId={deletingId}
                      />
                    </SwipeableRow>
                  ))}
                </div>
              ))
            )}
            {hasMore && (
              <button
                type="button"
                className="nfp-load-more"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <Loader2 size={13} className="nfp-spin" />
                  : null}
                {loadingMore ? 'Loading…' : 'Load older notifications'}
              </button>
            )}
          </div>

          {/* Detail pane — desktop only */}
          {isWide && (
            <div className="nfp-detail-pane">
              <DetailPane
                n={selected}
                onNavigate={onNavigate}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Notifications;
