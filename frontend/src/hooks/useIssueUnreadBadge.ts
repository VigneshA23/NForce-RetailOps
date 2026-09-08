import { useCallback, useEffect, useState } from 'react'
import { getMyIssues } from '../api/issues'

const POLL_INTERVAL_MS = 60_000

function lastSeenKey(employeeId: number): string {
  return `issuesSeen:${employeeId}`
}

export function useIssueUnreadBadge(employeeId: number | null, storeId: number) {
  const [hasUnread, setHasUnread] = useState(false)

  const check = useCallback(() => {
    if (employeeId == null) return
    getMyIssues(storeId)
      .then((issues) => {
        const raw = localStorage.getItem(lastSeenKey(employeeId))
        // lastSeen = 0 means never visited — badge if ANY issue has an admin response
        const lastSeen = raw ? new Date(raw).getTime() : 0
        setHasUnread(
          issues.some(
            (issue) => issue.respondedAt !== null && new Date(issue.respondedAt).getTime() > lastSeen,
          ),
        )
      })
      .catch(() => {})
  }, [employeeId, storeId])

  useEffect(() => {
    check()
    const id = window.setInterval(check, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [check])

  const markSeen = useCallback(() => {
    if (employeeId == null) return
    localStorage.setItem(lastSeenKey(employeeId), new Date().toISOString())
    setHasUnread(false)
  }, [employeeId])

  return { hasUnread, markSeen }
}
