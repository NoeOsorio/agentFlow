// @plan B1-PR-2
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodePalette } from '../NodePalette'
import { usePipelineStore } from '../../../store/pipelineStore'
import { useCompanyStore } from '../../../store/companyStore'
import type { Company } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_COMPANY: Company = {
  apiVersion: 'agentflow.ai/v1',
  kind: 'Company',
  metadata: { name: 'acme-corp', namespace: 'default' },
  spec: {
    agents: [
      {
        name: 'alice',
        role: 'Lead Engineer',
        model: { provider: 'anthropic', model_id: 'claude-opus-4-6' },
      },
      {
        name: 'bob',
        role: 'CEO',
        model: { provider: 'anthropic', model_id: 'claude-opus-4-6' },
      },
    ],
  },
}

function resetStores() {
  usePipelineStore.setState({
    pipelineId: null,
    pipelineName: 'untitled',
    namespace: 'default',
    companyRef: null,
    saveStatus: 'idle',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    yamlSpec: '',
    yamlValid: false,
    yamlErrors: [],
    yamlPanelOpen: false,
    yamlPanelWidth: 400,
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    activeRunId: null,
    nodeRunStates: {},
    _isSyncing: false,
  })
  useCompanyStore.setState(s => ({ ...s, company: null, agentBudgets: {}, agentHealth: {} }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NodePalette', () => {
  beforeEach(() => {
    resetStores()
  })

  it('renders static section headers without company', () => {
    render(<NodePalette />)
    expect(screen.getByText('Control Flow')).toBeInTheDocument()
    expect(screen.getByText('AI & Models')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('Integration')).toBeInTheDocument()
  })

  it('does NOT render Company Agents section when companyRef is null', () => {
    render(<NodePalette />)
    expect(screen.queryByText('Company Agents')).not.toBeInTheDocument()
    expect(screen.queryByTestId('palette-agent-alice')).not.toBeInTheDocument()
  })

  it('renders one palette item per agent when companyRef is set', () => {
    usePipelineStore.setState({ companyRef: { name: 'acme-corp', namespace: 'default' } })
    useCompanyStore.setState(s => ({ ...s, company: MOCK_COMPANY }))

    render(<NodePalette />)

    expect(screen.getByText('Company Agents')).toBeInTheDocument()
    expect(screen.getByTestId('palette-agent-alice')).toBeInTheDocument()
    expect(screen.getByTestId('palette-agent-bob')).toBeInTheDocument()
  })

  it('shows budget badge in red when pctUsed > 0.8', () => {
    usePipelineStore.setState({ companyRef: { name: 'acme-corp', namespace: 'default' } })
    useCompanyStore.setState(s => ({
      ...s,
      company: MOCK_COMPANY,
      agentBudgets: {
        alice: {
          agentName: 'alice',
          spentUsd: 90,
          budgetUsd: 100,
          remainingUsd: 10,
          pctUsed: 0.9,
          month: '2026-04',
        },
      },
    }))

    render(<NodePalette />)

    const badge = screen.getByTestId('budget-badge-alice')
    expect(badge).toBeInTheDocument()
    // Red badge classes
    expect(badge).toHaveClass('bg-red-900')
  })

  it('does NOT show red badge when pctUsed <= 0.8', () => {
    usePipelineStore.setState({ companyRef: { name: 'acme-corp', namespace: 'default' } })
    useCompanyStore.setState(s => ({
      ...s,
      company: MOCK_COMPANY,
      agentBudgets: {
        alice: {
          agentName: 'alice',
          spentUsd: 50,
          budgetUsd: 100,
          remainingUsd: 50,
          pctUsed: 0.5,
          month: '2026-04',
        },
      },
    }))

    render(<NodePalette />)

    const badge = screen.getByTestId('budget-badge-alice')
    expect(badge).not.toHaveClass('bg-red-900')
  })

  it('filter "llm" shows only the LLM node item', async () => {
    render(<NodePalette />)
    const user = userEvent.setup()

    const input = screen.getByRole('searchbox')
    await user.type(input, 'llm')

    // LLM should be visible
    expect(screen.getByTestId('palette-item-llm')).toBeInTheDocument()

    // Other types should be hidden
    expect(screen.queryByTestId('palette-item-start')).not.toBeInTheDocument()
    expect(screen.queryByTestId('palette-item-code')).not.toBeInTheDocument()
    expect(screen.queryByTestId('palette-item-http')).not.toBeInTheDocument()
  })

  it('agent palette items are draggable with the correct attribute', () => {
    usePipelineStore.setState({ companyRef: { name: 'acme-corp', namespace: 'default' } })
    useCompanyStore.setState(s => ({ ...s, company: MOCK_COMPANY }))

    render(<NodePalette />)

    const aliceItem = screen.getByTestId('palette-agent-alice')
    expect(aliceItem).toHaveAttribute('draggable', 'true')

    const bobItem = screen.getByTestId('palette-agent-bob')
    expect(bobItem).toHaveAttribute('draggable', 'true')
  })
})
