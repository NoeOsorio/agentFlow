// @plan B2-PR-2
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentSelector } from '../forms/widgets/AgentSelector'

const agents = [
  {
    name: 'alice',
    role: 'Lead Engineer',
    model: { provider: 'anthropic' as const, model_id: 'claude-sonnet-4-6' },
    budget: { monthly_usd: 80, alert_threshold_pct: 80 },
  },
  {
    name: 'bob',
    role: 'QA Engineer',
    model: { provider: 'anthropic' as const, model_id: 'claude-haiku-4-5-20251001' },
    budget: { monthly_usd: 50, alert_threshold_pct: 80 },
  },
  {
    name: 'carol',
    role: 'Data Scientist',
    model: { provider: 'openai' as const, model_id: 'gpt-4o' },
  },
]

describe('AgentSelector', () => {
  it('lists agents in the expected format after opening dropdown', () => {
    render(<AgentSelector value={null} onChange={vi.fn()} availableAgents={agents} />)

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText(/alice — Lead Engineer/)).toBeInTheDocument()
    expect(screen.getByText(/bob — QA Engineer/)).toBeInTheDocument()
    expect(screen.getByText(/carol — Data Scientist/)).toBeInTheDocument()

    // Budget badge
    expect(screen.getByText('$80 left')).toBeInTheDocument()
    expect(screen.getByText('$50 left')).toBeInTheDocument()
  })

  it('filters agents by name when typing in search input', () => {
    render(<AgentSelector value={null} onChange={vi.fn()} availableAgents={agents} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText(/Search by name or role/), {
      target: { value: 'alice' },
    })

    expect(screen.getByText(/alice — Lead Engineer/)).toBeInTheDocument()
    expect(screen.queryByText(/bob — QA Engineer/)).not.toBeInTheDocument()
  })

  it('filters agents by role when typing in search input', () => {
    render(<AgentSelector value={null} onChange={vi.fn()} availableAgents={agents} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText(/Search by name or role/), {
      target: { value: 'data' },
    })

    expect(screen.getByText(/carol — Data Scientist/)).toBeInTheDocument()
    expect(screen.queryByText(/alice — Lead Engineer/)).not.toBeInTheDocument()
  })

  it('shows "No agent selected" with warning style when value is null', () => {
    render(<AgentSelector value={null} onChange={vi.fn()} availableAgents={agents} />)

    const btn = screen.getByRole('button')
    expect(screen.getByText(/No agent selected/)).toBeInTheDocument()
    expect(btn.className).toContain('orange')
  })
})
