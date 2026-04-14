// @plan B4-PR-2
import { create } from 'zustand'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogEntryStatus = 'running' | 'completed' | 'failed' | 'info'

export type LogEntry = {
  id: string
  timestamp: Date
  agentName?: string
  agentRole?: string
  nodeId: string
  status: LogEntryStatus
  tokensUsed?: number
  costUsd?: number
  message?: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface LogsStore {
  logs: LogEntry[]
  addLog(entry: Omit<LogEntry, 'id'>): void
  clearLogs(): void
}

const MAX_LOGS = 500

export const useLogsStore = create<LogsStore>()((set) => ({
  logs: [],

  addLog(entry) {
    set((s) => ({
      logs: [{ ...entry, id: nanoid(8) }, ...s.logs].slice(0, MAX_LOGS),
    }))
  },

  clearLogs() {
    set({ logs: [] })
  },
}))
