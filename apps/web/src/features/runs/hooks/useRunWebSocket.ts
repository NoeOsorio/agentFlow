// @plan B4
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePipelineStore } from '../../../store/pipelineStore'
import { useCompanyStore } from '../../../store/companyStore'
import { useLogsStore } from '../../../store/logsStore'

// ---------------------------------------------------------------------------
// StreamEvent types
// ---------------------------------------------------------------------------

export type NodeStartEvent = {
  type: 'node_start'
  nodeId: string
  agentName?: string
  agentRole?: string
  companyName?: string
  startedAt: number
}

export type NodeCompleteEvent = {
  type: 'node_complete'
  nodeId: string
  agentName?: string
  agentRole?: string
  finishedAt: number
  tokensUsed: number
  costUsd: number
  output?: unknown
}

export type NodeErrorEvent = {
  type: 'node_error'
  nodeId: string
  agentName?: string
  error: string
}

export type PipelineCompleteEvent = {
  type: 'pipeline_complete'
  totalCost: number
  totalTokens: number
  durationMs: number
}

export type HumanInputRequiredEvent = {
  type: 'human_input_required'
  nodeId: string
  prompt: string
  agentName?: string
}

export type StreamEvent =
  | NodeStartEvent
  | NodeCompleteEvent
  | NodeErrorEvent
  | PipelineCompleteEvent
  | HumanInputRequiredEvent

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export type RunConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MS = 1000
const DEFAULT_BUDGET_USD = 100

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRunWebSocket(runId: string | null): {
  connectionStatus: RunConnectionStatus
  lastEvent: StreamEvent | null
} {
  const [connectionStatus, setConnectionStatus] = useState<RunConnectionStatus>('disconnected')
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateNodeRunState = usePipelineStore((s) => s.updateNodeRunState)
  const setActiveRun = usePipelineStore((s) => s.setActiveRun)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const setAgentBudget = useCompanyStore((s) => s.setAgentBudget)
  const addLog = useLogsStore((s) => s.addLog)

  // Keep stable refs to store actions (avoid stale closures)
  const updateNodeRunStateRef = useRef(updateNodeRunState)
  const setActiveRunRef = useRef(setActiveRun)
  const agentBudgetsRef = useRef(agentBudgets)
  const setAgentBudgetRef = useRef(setAgentBudget)
  const addLogRef = useRef(addLog)

  useEffect(() => { updateNodeRunStateRef.current = updateNodeRunState }, [updateNodeRunState])
  useEffect(() => { setActiveRunRef.current = setActiveRun }, [setActiveRun])
  useEffect(() => { agentBudgetsRef.current = agentBudgets }, [agentBudgets])
  useEffect(() => { setAgentBudgetRef.current = setAgentBudget }, [setAgentBudget])
  useEffect(() => { addLogRef.current = addLog }, [addLog])

  const handleEvent = useCallback((event: StreamEvent) => {
    setLastEvent(event)

    switch (event.type) {
      case 'node_start': {
        updateNodeRunStateRef.current(event.nodeId, {
          status: 'running',
          startedAt: event.startedAt,
          agentName: event.agentName,
          agentRole: event.agentRole,
        })
        addLogRef.current({
          nodeId: event.nodeId,
          agentName: event.agentName,
          agentRole: event.agentRole,
          status: 'running',
          message: `Node ${event.nodeId} started${event.agentName ? ` (${event.agentName})` : ''}`,
        })
        break
      }

      case 'node_complete': {
        updateNodeRunStateRef.current(event.nodeId, {
          status: 'completed',
          finishedAt: event.finishedAt,
          tokensUsed: event.tokensUsed,
          costUsd: event.costUsd,
          agentName: event.agentName,
        })

        // Update budget
        if (event.agentName) {
          const current = agentBudgetsRef.current[event.agentName]
          const budgetUsd = current?.budgetUsd ?? DEFAULT_BUDGET_USD
          const newSpent = (current?.spentUsd ?? 0) + event.costUsd
          const remainingUsd = Math.max(0, budgetUsd - newSpent)
          const pctUsed = budgetUsd > 0 ? (newSpent / budgetUsd) * 100 : 0
          const month = current?.month ?? new Date().toISOString().slice(0, 7)
          setAgentBudgetRef.current(event.agentName, {
            agentName: event.agentName,
            spentUsd: newSpent,
            budgetUsd,
            remainingUsd,
            pctUsed,
            month,
          })
        }

        addLogRef.current({
          nodeId: event.nodeId,
          agentName: event.agentName,
          status: 'completed',
          message: `Node ${event.nodeId} completed${event.agentName ? ` (${event.agentName})` : ''} — ${event.tokensUsed} tokens, $${event.costUsd.toFixed(4)}`,
          tokensUsed: event.tokensUsed,
          costUsd: event.costUsd,
        })
        break
      }

      case 'node_error': {
        updateNodeRunStateRef.current(event.nodeId, {
          status: 'failed',
          error: event.error,
          agentName: event.agentName,
        })
        addLogRef.current({
          nodeId: event.nodeId,
          agentName: event.agentName,
          status: 'failed',
          message: `Node ${event.nodeId} failed${event.agentName ? ` (${event.agentName})` : ''}: ${event.error}`,
          error: event.error,
        })
        break
      }

      case 'pipeline_complete': {
        setActiveRunRef.current(null)
        addLogRef.current({
          status: 'pipeline_complete',
          message: `Pipeline complete — total cost $${event.totalCost.toFixed(4)}, ${event.totalTokens} tokens, ${event.durationMs}ms`,
          tokensUsed: event.totalTokens,
          costUsd: event.totalCost,
        })
        break
      }

      case 'human_input_required': {
        addLogRef.current({
          nodeId: event.nodeId,
          agentName: event.agentName,
          status: 'approval_required',
          message: `Human input required for node ${event.nodeId}: ${event.prompt}`,
          approvalPrompt: event.prompt,
          approvalNodeId: event.nodeId,
        })
        break
      }
    }
  }, [])

  const connectRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!runId) {
      setConnectionStatus('disconnected')
      return
    }

    let cancelled = false

    function connect() {
      if (cancelled) return

      setConnectionStatus('connecting')
      const ws = new WebSocket(`ws://localhost:8000/api/ws/runs/${runId}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        attemptsRef.current = 0
        setConnectionStatus('connected')
      }

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (cancelled) return
        try {
          const event = JSON.parse(ev.data) as StreamEvent
          handleEvent(event)
        } catch {
          // malformed JSON — ignore
        }
      }

      ws.onerror = () => {
        if (cancelled) return
        setConnectionStatus('error')
      }

      ws.onclose = () => {
        if (cancelled) return
        setConnectionStatus('disconnected')
        const attempt = attemptsRef.current
        if (attempt < MAX_ATTEMPTS) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt)
          attemptsRef.current = attempt + 1
          backoffTimerRef.current = setTimeout(() => {
            if (!cancelled) connect()
          }, delay)
        }
      }
    }

    connectRef.current = connect
    connect()

    return () => {
      cancelled = true
      if (backoffTimerRef.current) {
        clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      attemptsRef.current = 0
      setConnectionStatus('disconnected')
    }
  }, [runId, handleEvent])

  return { connectionStatus, lastEvent }
}
