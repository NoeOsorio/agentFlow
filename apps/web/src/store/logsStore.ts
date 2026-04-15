// @plan B4
import { create } from 'zustand'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogEntry = {
  id: string
  timestamp: number
  nodeId?: string
  agentName?: string
  agentRole?: string
  status: 'running' | 'completed' | 'failed' | 'pipeline_complete' | 'info' | 'approval_required'
  message: string
  tokensUsed?: number
  costUsd?: number
  error?: string
  // For approval_required:
  approvalPrompt?: string
  approvalRunId?: string
  approvalNodeId?: string
}

interface LogsStore {
  logs: LogEntry[]
  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void
  clearLogs(): void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLogsStore = create<LogsStore>()((set) => ({
  logs: [],

  addLog(entry) {
    const log: LogEntry = {
      ...entry,
      id: nanoid(),
      timestamp: Date.now(),
    }
    set((state) => ({ logs: [...state.logs, log] }))
  },

  clearLogs() {
    set({ logs: [] })
  },
}))
