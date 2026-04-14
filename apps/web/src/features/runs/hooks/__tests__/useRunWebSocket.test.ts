// @plan B4-PR-1
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunWebSocket } from '../useRunWebSocket'
import { usePipelineStore } from '../../../../store/pipelineStore'
import { useCompanyStore } from '../../../../store/companyStore'

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = []
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  readyState = WebSocket.CONNECTING
  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(_data: string) {}

  close() {
    this.readyState = WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify(data) }),
    )
  }
}

vi.stubGlobal('WebSocket', MockWebSocket)

// ---------------------------------------------------------------------------
// Store spies
// ---------------------------------------------------------------------------

let updateNodeRunState: ReturnType<typeof vi.spyOn>
let setActiveRun: ReturnType<typeof vi.spyOn>
let setAgentBudget: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  MockWebSocket.instances = []
  updateNodeRunState = vi.spyOn(usePipelineStore.getState(), 'updateNodeRunState')
  setActiveRun = vi.spyOn(usePipelineStore.getState(), 'setActiveRun')
  setAgentBudget = vi.spyOn(useCompanyStore.getState(), 'setAgentBudget')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRunWebSocket', () => {
  it('does not create a WebSocket when runId is null', () => {
    renderHook(() => useRunWebSocket(null))
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('creates a WebSocket when runId is provided', () => {
    renderHook(() => useRunWebSocket('run-123'))
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0]!.url).toContain('run-123')
  })

  it('dispatches updateNodeRunState on node_start', () => {
    renderHook(() => useRunWebSocket('run-123'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.simulateOpen()
      ws.simulateMessage({
        type: 'node_start',
        node_id: 'node_abc',
        agent_name: 'Alice',
        agent_role: 'Lead Engineer',
        timestamp: new Date().toISOString(),
      })
    })

    expect(updateNodeRunState).toHaveBeenCalledWith('node_abc', expect.objectContaining({
      status: 'running',
      agentName: 'Alice',
      agentRole: 'Lead Engineer',
    }))
  })

  it('dispatches updateNodeRunState on node_complete', () => {
    renderHook(() => useRunWebSocket('run-123'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.simulateOpen()
      ws.simulateMessage({
        type: 'node_complete',
        node_id: 'node_abc',
        agent_name: 'Alice',
        tokens_used: 1234,
        cost_usd: 0.0037,
        timestamp: new Date().toISOString(),
      })
    })

    expect(updateNodeRunState).toHaveBeenCalledWith('node_abc', expect.objectContaining({
      status: 'completed',
      tokensUsed: 1234,
      costUsd: 0.0037,
    }))
  })

  it('dispatches setActiveRun(null) on pipeline_complete', () => {
    renderHook(() => useRunWebSocket('run-123'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.simulateOpen()
      ws.simulateMessage({
        type: 'pipeline_complete',
        node_id: '',
        timestamp: new Date().toISOString(),
      })
    })

    expect(setActiveRun).toHaveBeenCalledWith(null)
  })

  it('closes WebSocket on cleanup', () => {
    const { unmount } = renderHook(() => useRunWebSocket('run-123'))
    const ws = MockWebSocket.instances[0]!
    act(() => { ws.simulateOpen() })

    const closeSpy = vi.spyOn(ws, 'close')
    unmount()
    expect(closeSpy).toHaveBeenCalled()
  })
})
