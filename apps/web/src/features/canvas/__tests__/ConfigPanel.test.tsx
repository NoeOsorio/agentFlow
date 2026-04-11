// @plan B1-PR-3
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConfigPanel } from '../ConfigPanel'
import type { CanvasNode } from '../../../store/types'
import type { PipelineNode } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@agentflow/ui', () => ({
  nodeConfigForms: {
    llm: ({ value }: { value: PipelineNode }) => (
      <div data-testid="llm-form">LLMNodeForm for {(value as { id: string }).id}</div>
    ),
    agent_pod: () => <div data-testid="agent-pod-form">AgentPodForm</div>,
  },
}))

// Mutable store state driven by each test
const storeState = {
  selectedNodeId: null as string | null,
  nodes: [] as CanvasNode[],
  yamlErrors: [] as { nodeId: string; field: string; message: string }[],
  deleteNode: vi.fn(),
  updateNodeConfig: vi.fn(),
  deselectNode: vi.fn(),
}

vi.mock('../../../store/pipelineStore', () => ({
  usePipelineStore: (sel: (s: typeof storeState) => unknown) => sel(storeState),
  useNodeValidationErrors: (nodeId: string) =>
    storeState.yamlErrors.filter(e => e.nodeId === nodeId),
}))

// ---------------------------------------------------------------------------
// Sample nodes
// ---------------------------------------------------------------------------

const LLM_NODE: CanvasNode = {
  id: 'llm_abc123',
  type: 'llm',
  position: { x: 0, y: 0 },
  data: {
    id: 'llm_abc123',
    type: 'llm',
    model: { provider: 'openai', model_id: 'gpt-4o' },
    prompt: { user: '' },
  } as PipelineNode,
}

const AGENT_NODE: CanvasNode = {
  id: 'agent_pod_xyz',
  type: 'agent_pod',
  position: { x: 100, y: 0 },
  data: {
    id: 'agent_pod_xyz',
    type: 'agent_pod',
    agent_ref: null,
    instruction: '',
  } as unknown as PipelineNode,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState(overrides: Partial<typeof storeState> = {}): void {
  Object.assign(storeState, {
    selectedNodeId: null,
    nodes: [],
    yamlErrors: [],
    deleteNode: vi.fn(),
    updateNodeConfig: vi.fn(),
    deselectNode: vi.fn(),
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  afterEach(() => {
    cleanup()
  })

  it('is not visible when selectedNodeId is null', () => {
    resetState({ selectedNodeId: null, nodes: [] })
    render(<ConfigPanel />)
    expect(screen.queryByTestId('llm-form')).toBeNull()
    expect(screen.queryByTestId('agent-pod-form')).toBeNull()
  })

  it('renders LLMNodeForm when selectedNodeId points to an llm node', () => {
    resetState({ selectedNodeId: 'llm_abc123', nodes: [LLM_NODE] })
    render(<ConfigPanel />)
    expect(screen.getByTestId('llm-form')).toBeTruthy()
  })

  it('shows NodeValidationError in panel for agent_pod node with no agent_ref', () => {
    resetState({
      selectedNodeId: 'agent_pod_xyz',
      nodes: [AGENT_NODE],
      yamlErrors: [
        {
          nodeId: 'agent_pod_xyz',
          field: 'agent_ref',
          message: 'agent_pod node has no agent_ref selected',
        },
      ],
    })
    render(<ConfigPanel />)
    expect(screen.getByText('agent_pod node has no agent_ref selected')).toBeTruthy()
  })

  it('shows confirmation dialog before calling deleteNode', () => {
    const deleteNode = vi.fn()
    resetState({ selectedNodeId: 'llm_abc123', nodes: [LLM_NODE], deleteNode })
    render(<ConfigPanel />)

    // First click shows confirmation
    fireEvent.click(screen.getByText('Delete Node'))
    expect(screen.getByText('Delete this node and its edges?')).toBeTruthy()
    expect(deleteNode).not.toHaveBeenCalled()

    // Second click (confirm) calls deleteNode
    fireEvent.click(screen.getByText('Delete'))
    expect(deleteNode).toHaveBeenCalledWith('llm_abc123')
  })

  it('cancels delete when Cancel is clicked', () => {
    const deleteNode = vi.fn()
    resetState({ selectedNodeId: 'llm_abc123', nodes: [LLM_NODE], deleteNode })
    render(<ConfigPanel />)

    fireEvent.click(screen.getByText('Delete Node'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(deleteNode).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete this node and its edges?')).toBeNull()
  })
})
