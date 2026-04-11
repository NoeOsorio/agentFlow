// @plan B2-PR-2
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentPodNodeCard } from '../nodes/AgentPodNodeCard'
import { BudgetBar } from '../nodes/BudgetBar'
import type { AgentPodNodeData } from '../nodes/AgentPodNodeCard'
import type { NodeProps } from '@xyflow/react'

// Mock @xyflow/react handles since they need a ReactFlow context
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

const agentSpec = {
  role: 'Lead Engineer',
  persona: 'Senior Python engineer. Direct communicator. Focused on quality.',
  model: { provider: 'anthropic' as const, model_id: 'claude-sonnet-4-6' },
  budget: { monthly_usd: 100, alert_threshold_pct: 80 },
}

function makeProps(overrides: Partial<AgentPodNodeData> = {}): NodeProps {
  return {
    id: 'node-1',
    type: 'agent_pod',
    data: {
      id: 'node-1',
      type: 'agent_pod',
      agent_ref: { name: 'alice' },
      instruction: 'Do the thing',
      ...overrides,
    },
    selected: false,
    dragging: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as unknown as NodeProps
}

describe('AgentPodNodeCard', () => {
  it('renders role badge and persona snippet when agentSpec is provided', () => {
    render(<AgentPodNodeCard {...makeProps({ agentSpec })} />)

    expect(screen.getByText('Lead Engineer')).toBeInTheDocument()
    expect(screen.getByText(/Senior Python engineer/)).toBeInTheDocument()
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument()
  })

  it('shows orange "Select agent ▾" placeholder when agentSpec is null', () => {
    render(<AgentPodNodeCard {...makeProps()} />)

    const placeholder = screen.getByText(/Select agent ▾/)
    expect(placeholder).toBeInTheDocument()
    expect(placeholder.className).toContain('orange')
  })

  it('shows running overlay (animate-pulse) when runStatus is running', () => {
    const { container } = render(
      <AgentPodNodeCard {...makeProps({ agentSpec, runStatus: 'running' })} />,
    )

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })
})

describe('BudgetBar', () => {
  it('shows green color at 55% usage', () => {
    render(<BudgetBar spent={55} budget={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('bg-green-500')
  })

  it('shows yellow color at 75% usage', () => {
    render(<BudgetBar spent={75} budget={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('bg-yellow-400')
  })

  it('shows red color at 90% usage', () => {
    render(<BudgetBar spent={90} budget={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('bg-red-500')
  })
})
