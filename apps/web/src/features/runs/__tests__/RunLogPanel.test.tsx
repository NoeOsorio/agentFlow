// @plan B4-PR-2
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunLogPanel } from '../RunLogPanel'
import { useLogsStore } from '../../../store/logsStore'

beforeEach(() => {
  useLogsStore.getState().clearLogs()
})

describe('RunLogPanel', () => {
  it('opens and displays log entries when toggle is clicked', () => {
    useLogsStore.getState().addLog({
      timestamp: new Date('2024-01-01T14:23:08.440Z'),
      agentName: 'Alice',
      agentRole: 'Lead Engineer',
      nodeId: 'plan_node',
      status: 'completed',
      tokensUsed: 1234,
      costUsd: 0.0037,
    })

    render(<RunLogPanel />)
    fireEvent.click(screen.getByText(/Logs/))

    expect(screen.getByText(/Alice/)).toBeDefined()
    expect(screen.getByText(/Lead Engineer/)).toBeDefined()
    expect(screen.getByText(/plan_node/)).toBeDefined()
  })

  it('filter "Errors" hides non-failed entries', () => {
    useLogsStore.getState().addLog({
      timestamp: new Date(),
      agentName: 'Alice',
      nodeId: 'node1',
      status: 'completed',
    })
    useLogsStore.getState().addLog({
      timestamp: new Date(),
      agentName: 'Bob',
      nodeId: 'node2',
      status: 'failed',
    })

    render(<RunLogPanel />)
    fireEvent.click(screen.getByText(/Logs/))
    fireEvent.click(screen.getByText('Errors'))

    expect(screen.getByText(/node2/)).toBeDefined()
    expect(screen.queryByText(/node1/)).toBeNull()
  })

  it('"Clear" button empties the logs', () => {
    useLogsStore.getState().addLog({
      timestamp: new Date(),
      nodeId: 'node1',
      status: 'info',
    })

    render(<RunLogPanel />)
    fireEvent.click(screen.getByText(/Logs/))
    fireEvent.click(screen.getByText('Clear'))

    expect(useLogsStore.getState().logs).toHaveLength(0)
  })
})
