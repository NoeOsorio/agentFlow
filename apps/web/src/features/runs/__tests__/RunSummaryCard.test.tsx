// @plan B4-PR-4
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RunSummaryCard, useRunSummaryStore } from '../RunSummaryCard'
import type { RunSummary } from '../RunSummaryCard'

beforeEach(() => {
  useRunSummaryStore.getState().dismiss()
})

afterEach(() => {
  vi.useRealTimers()
})

const mockSummary: RunSummary = {
  id: 'run-1',
  status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
  started_at: '2024-01-01T00:00:00Z',
  finished_at: '2024-01-01T00:00:05Z',
  agent_executions: [
    { agent_name: 'Alice', tokens_used: 2341, cost_usd: 0.007 },
    { agent_name: 'Bob',   tokens_used: 890,  cost_usd: 0.0134 },
  ],
}

describe('RunSummaryCard', () => {
  it('does not render when show is false', () => {
    const { container } = render(<RunSummaryCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders per-agent rows with tokens and cost', () => {
    useRunSummaryStore.getState().setSummary(mockSummary)
    render(<RunSummaryCard />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('2,341')).toBeDefined()
  })

  it('Total row sums all agents correctly', () => {
    useRunSummaryStore.getState().setSummary(mockSummary)
    render(<RunSummaryCard />)
    // Total tokens: 2341 + 890 = 3231
    expect(screen.getByText('3,231')).toBeDefined()
  })

  it('auto-dismisses after 10s for completed run', () => {
    vi.useFakeTimers()
    useRunSummaryStore.getState().setSummary(mockSummary)
    render(<RunSummaryCard />)
    expect(useRunSummaryStore.getState().show).toBe(true)

    act(() => { vi.advanceTimersByTime(10_000) })
    expect(useRunSummaryStore.getState().show).toBe(false)
  })

  it('does NOT auto-dismiss if status is failed', () => {
    vi.useFakeTimers()
    useRunSummaryStore.getState().setSummary({ ...mockSummary, status: 'failed' })
    render(<RunSummaryCard />)

    act(() => { vi.advanceTimersByTime(15_000) })
    expect(useRunSummaryStore.getState().show).toBe(true)
  })
})
