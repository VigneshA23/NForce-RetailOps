import { useCallback, useEffect, useRef, useState } from 'react'
import { getMissedTasks } from '../api/missedTasks'

const POLL_INTERVAL_MS = 60_000

// Powers the "Missing Tasks" nav badge and the dashboard banner from a single
// poller, the same shape as useIssueUnreadBadge -- refresh() lets callers
// (e.g. MissingTasks after a completion) force an immediate recheck instead
// of waiting out the interval.
export function useMissedTasksBadge(storeId: number) {
  const [count, setCount] = useState(0)
  // Cancels a still-in-flight refresh before starting another -- without this,
  // React's dev-mode double-invoked mount effect (and any refresh() overlapping
  // a slow in-flight one) fires two real requests to this endpoint for a
  // single logical refresh.
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    getMissedTasks(storeId, null, controller.signal)
      .then((page) => setCount(page.totalInstances))
      .catch(() => {})
  }, [storeId])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      controllerRef.current?.abort()
    }
  }, [refresh])

  return { count, refresh }
}
