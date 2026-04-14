// @plan B4-PR-1
import { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '../../../store/pipelineStore'
import { useCompanyStore } from '../../../store/companyStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamEvent = {
  type:
    | 'node_start'
    | 'node_complete'
    | 'node_error'
    | 'pipeline_complete'
    | 'human_input_required'
  node_id: string
  agent_name?: string
  agent_role?: string
  company_name?: string
  tokens_used?: number
  cost_usd?: number
  error?: string
  prompt?: string
  timestamp: string
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30_000

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRunWebSocket(runId: string | null): {
  connectionStatus: ConnectionStatus
  lastEvent: StreamEvent | null
} {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    if (!runId) {
      setConnectionStatus('disconnected')
      return
    }

    function connect() {
      if (unmountedRef.current) return
      setConnectionStatus('connecting')

      const ws = new WebSocket(`ws://localhost:8000/api/ws/runs/${runId}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return }
        retryCountRef.current = 0
        setConnectionStatus('connected')
      }

      ws.onmessage = (evt: MessageEvent) => {
        if (unmountedRef.current) return
        let event: StreamEvent
        try {
          event = JSON.parse(evt.data as string) as StreamEvent
        } catch {
          return
        }

        setLastEvent(event)
        handleEvent(event)
      }

      ws.onerror = () => {
        if (unmountedRef.current) return
        setConnectionStatus('error')
      }

      ws.onclose = () => {
        if (unmountedRef.current) return
        setConnectionStatus('disconnected')
        scheduleReconnect()
      }
    }

    function handleEvent(event: StreamEvent) {
      const { updateNodeRunState, setActiveRun } = usePipelineStore.getState()
      const { setAgentBudget, agentBudgets } = useCompanyStore.getState()

      switch (event.type) {
        case 'node_start':
          updateNodeRunState(event.node_id, {
            status: 'running',
            startedAt: Date.now(),
            agentName: event.agent_name,
            agentRole: event.agent_role,
          })
          break

        case 'node_complete': {
          updateNodeRunState(event.node_id, {
            status: 'completed',
            finishedAt: Date.now(),
            tokensUsed: event.tokens_used,
            costUsd: event.cost_usd,
            agentName: event.agent_name,
          })
          if (event.agent_name && event.cost_usd != null) {
            const current = agentBudgets[event.agent_name]
            const spent = (current?.spentUsd ?? 0) + event.cost_usd
            const budget = current?.budgetUsd ?? 0
            setAgentBudget(event.agent_name, {
              agentName: event.agent_name,
              spentUsd: spent,
              budgetUsd: budget,
              remainingUsd: Math.max(0, budget - spent),
              pctUsed: budget > 0 ? Math.min(1, spent / budget) : 0,
              month: current?.month ?? new Date().toISOString().slice(0, 7),
            })
          }
          break
        }

        case 'node_error':
          updateNodeRunState(event.node_id, {
            status: 'failed',
            error: event.error,
            agentName: event.agent_name,
          })
          break

        case 'pipeline_complete':
          setActiveRun(null)
          break

        default:
          break
      }
    }

    function scheduleReconnect() {
      if (unmountedRef.current) return
      if (retryCountRef.current >= MAX_RETRIES) return

      const delay = Math.min(
        BASE_BACKOFF_MS * Math.pow(2, retryCountRef.current),
        MAX_BACKOFF_MS,
      )
      retryCountRef.current += 1

      retryTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect()
      }, delay)
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [runId])

  return { connectionStatus, lastEvent }
}
