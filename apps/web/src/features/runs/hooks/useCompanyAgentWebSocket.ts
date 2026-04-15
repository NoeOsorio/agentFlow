// @plan B4
import { useEffect, useRef } from 'react'
import { useCompanyStore } from '../../../store/companyStore'
import type { AgentHealthState } from '../../../store/types'

// ---------------------------------------------------------------------------
// Backend heartbeat message shape
// ---------------------------------------------------------------------------

type AgentHeartbeatMessage = {
  agent_name: string
  status: 'busy' | 'idle' | 'dead' | 'unknown'
  last_heartbeat: string | null
  current_run_id?: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompanyAgentWebSocket(companyId: string | null): void {
  const setAgentHealth = useCompanyStore((s) => s.setAgentHealth)
  const setAgentHealthRef = useRef(setAgentHealth)
  useEffect(() => { setAgentHealthRef.current = setAgentHealth }, [setAgentHealth])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!companyId) return

    let cancelled = false

    function connect() {
      if (cancelled) return

      const ws = new WebSocket(
        `ws://localhost:8000/api/ws/companies/${companyId}/agents`,
      )
      wsRef.current = ws

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (cancelled) return
        try {
          const msg = JSON.parse(ev.data) as AgentHeartbeatMessage

          let healthStatus: AgentHealthState['healthStatus']
          switch (msg.status) {
            case 'busy':
            case 'idle':
              healthStatus = 'healthy'
              break
            case 'dead':
              healthStatus = 'dead'
              break
            default:
              healthStatus = 'unknown'
          }

          const lastHeartbeatAt =
            msg.last_heartbeat ? new Date(msg.last_heartbeat) : null

          setAgentHealthRef.current(msg.agent_name, {
            agentName: msg.agent_name,
            healthStatus,
            lastHeartbeatAt,
          })
        } catch {
          // malformed JSON — ignore
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        reconnectTimerRef.current = setTimeout(() => {
          if (!cancelled) connect()
        }, 2000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [companyId])
}
