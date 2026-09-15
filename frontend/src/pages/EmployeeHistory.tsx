import { useEffect, useState } from 'react'
import { getCorrectionHistory, getShiftHistory } from '../api/history'
import type { StoreSummary } from '../types/store'
import type { ShiftHistory } from '../types/history'
import ChecklistDayHistoryView from '../components/ChecklistDayHistoryView'

interface EmployeeHistoryProps {
  store: StoreSummary
}

// YYYY-MM-DD from the Date object's own LOCAL calendar fields -- deliberately
// not toISOString().slice(0, 10), which converts to UTC first and silently
// shifts the date by a day for part of the day in any timezone ahead of UTC
// (e.g. early morning IST is still "yesterday" in UTC).
function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayDate(): string {
  return toDateKey(new Date())
}

function yesterdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateKey(date)
}

function EmployeeHistory({ store }: EmployeeHistoryProps) {
  // Defaults to yesterday: a shift's checklist is realistically only fully
  // wrapped up (and worth reviewing) once the day is over, so that's the more
  // useful starting point than an in-progress "today".
  const [selectedDate, setSelectedDate] = useState(yesterdayDate)
  const [history, setHistory] = useState<ShiftHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function loadHistory() {
    let active = true
    setLoading(true)
    setError(null)

    getShiftHistory(store.id, selectedDate)
      .then((result) => {
        if (!active) return
        setHistory(result)
      })
      .catch((err: Error) => {
        if (!active) return
        setHistory(null)
        setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }

  useEffect(() => {
    const cancel = loadHistory()
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id, selectedDate])

  return (
    <ChecklistDayHistoryView
      history={history}
      loading={loading}
      error={error}
      onRetry={loadHistory}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      maxDate={todayDate()}
      getCorrectionHistory={getCorrectionHistory}
    />
  )
}

export default EmployeeHistory
