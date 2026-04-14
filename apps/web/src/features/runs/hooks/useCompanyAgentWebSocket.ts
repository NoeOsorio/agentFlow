// @plan B4-PR-1
import { useEffect, useRef, useState } from 'react'
import { useCompanyStore } from '../../../store/companyStore'
import type { ConnectionStatus } from './useRunWebSocket'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentHeartbeatMessage {
  agent_name: string
  status: 'healthy' | 'degraded' | 'dead' | 'unknown'
  last_heartbeat: string
  current_run_id?: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompanyAgentWebSocket(companyId: string | null): {
  connectionStatus: ConnectionStatus
} {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const unmountedRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    unmountedRef.current = false

    if (!companyId) {
      setConnectionStatus('disconnected')
      return
    }

    function connect() {
      if (unmountedRef.current) return
      setConnectionStatus('connecting')

      const ws = new WebSocket(
        `ws://localhost:8000/api/ws/companies/${companyId}/agents`,
      )
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return }
        setConnectionStatus('connected')
      }

      ws.onmessage = (evt: MessageEvent) => {
        if (unmountedRef.current) return
        let msg: AgentHeartbeatMessage
        try {
          msg = JSON.parse(evt.data as string) as AgentHeartbeatMessage
        } catch {
          return
        }

        useCompanyStore.getState().setAgentHealth(msg.agent_name, {
          agentName: msg.agent_name,
          healthStatus: msg.status,
          lastHeartbeatAt: new Date(msg.last_heartbeat),
        })
      }

      ws.onerror = () => {
        if (unmountedRef.current) return
        setConnectionStatus('error')
      }

      ws.onclose = () => {
        if (unmountedRef.current) return
        setConnectionStatus('disconnected')
        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect()
        }, 3000)
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [companyId])

  return { connectionStatus }
}
