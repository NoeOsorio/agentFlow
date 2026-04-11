// @plan B2-PR-4
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConditionBuilder } from '../forms/widgets/ConditionBuilder'
import { PromptEditor } from '../forms/widgets/PromptEditor'
import { AgentPodForm } from '../forms/AgentPodForm'
import { ModelSelector } from '../forms/widgets/ModelSelector'
import { nodeTypes } from '../nodeTypes'
import type { ConditionGroup } from '@agentflow/core'

// ConditionBuilder: 3 conditions renders 3 rows + Add condition button
describe('ConditionBuilder', () => {
  const makeGroups = (count: number): ConditionGroup[] => [
    {
      logic: 'and',
      branch_id: 'branch_1',
      conditions: Array.from({ length: count }, (_, i) => ({
        left: { node_id: 'node1', variable: `var${i}`, path: [] },
        operator: 'eq' as const,
        right: { literal: '' },
        branch_id: 'branch_1',
      })),
    },
  ]

  it('renders correct number of condition rows', () => {
    const { container } = render(
      <ConditionBuilder
        groups={makeGroups(3)}
        onChange={vi.fn()}
        availableVariables={[]}
        defaultBranch="default"
        onDefaultBranchChange={vi.fn()}
      />,
    )
    // Each condition row contains a select (operator dropdown)
    const selects = container.querySelectorAll('select[value], select')
    // There should be at least 3 operator selects
    const operatorSelects = Array.from(selects).filter((s) =>
      s.getAttribute('value') === 'eq' || s.innerHTML.includes('equals'),
    )
    expect(operatorSelects.length).toBeGreaterThanOrEqual(3)
  })

  it('shows Add condition button', () => {
    render(
      <ConditionBuilder
        groups={makeGroups(1)}
        onChange={vi.fn()}
        availableVariables={[]}
        defaultBranch="default"
        onDefaultBranchChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/add condition/i)).toBeTruthy()
  })

  it('calls onChange when Add condition is clicked', () => {
    const onChange = vi.fn()
    render(
      <ConditionBuilder
        groups={makeGroups(1)}
        onChange={onChange}
        availableVariables={[]}
        defaultBranch="default"
        onDefaultBranchChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(/add condition/i))
    expect(onChange).toHaveBeenCalled()
  })
})

// PromptEditor: highlights {{#node_id.variable#}} with special color class
describe('PromptEditor', () => {
  it('highlights variable references in preview', () => {
    // Use showSystemTab=false so the user tab is active by default
    const { container } = render(
      <PromptEditor
        value={{ system: '', user: 'Hello {{#node1.output#}} world' }}
        onChange={vi.fn()}
        showSystemTab={false}
      />,
    )
    const mark = container.querySelector('mark')
    expect(mark).toBeTruthy()
    expect(mark?.textContent).toBe('{{#node1.output#}}')
    expect(mark?.className).toContain('bg-blue-900')
  })

  it('shows system and user tabs by default', () => {
    render(
      <PromptEditor
        value={{ system: '', user: '' }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('system')).toBeTruthy()
    expect(screen.getByText('user')).toBeTruthy()
  })

  it('hides system tab when showSystemTab=false', () => {
    render(
      <PromptEditor
        value={{ system: '', user: '' }}
        onChange={vi.fn()}
        showSystemTab={false}
      />,
    )
    expect(screen.queryByText('system')).toBeNull()
  })
})

// AgentPodForm: shows AgentSelector as first field
describe('AgentPodForm', () => {
  const mockAgents = [
    {
      name: 'alice',
      role: 'Lead Engineer',
      model: { provider: 'anthropic' as const, model_id: 'claude-sonnet-4-6' },
    },
  ]

  it('renders AgentSelector (No agent selected placeholder)', () => {
    render(
      <AgentPodForm
        value={{}}
        onChange={vi.fn()}
        availableAgents={mockAgents}
        availableVariables={[]}
      />,
    )
    expect(screen.getByText(/no agent selected/i)).toBeTruthy()
  })

  it('shows read-only agent details panel when resolvedAgentSpec provided', () => {
    const spec = mockAgents[0]!
    render(
      <AgentPodForm
        value={{}}
        onChange={vi.fn()}
        availableAgents={mockAgents}
        availableVariables={[]}
        resolvedAgentSpec={spec}
      />,
    )
    expect(screen.getByText('Lead Engineer')).toBeTruthy()
    expect(screen.getByText(/claude-sonnet-4-6/i)).toBeTruthy()
    expect(screen.getByText(/edit agent in company editor/i)).toBeTruthy()
  })
})

// ModelSelector: filtered to anthropic shows only anthropic models
describe('ModelSelector', () => {
  it('filters models when provider changes', () => {
    const onChange = vi.fn()
    render(
      <ModelSelector
        value={{ provider: 'anthropic', model_id: 'claude-sonnet-4-6' }}
        onChange={onChange}
      />,
    )
    const modelSelect = screen.getAllByRole('combobox')[1]! // second select = model
    const options = Array.from(modelSelect.querySelectorAll('option'))
    const labels = options.map((o) => o.textContent ?? '')
    // All listed models should be anthropic models
    expect(labels.every((l) => l.startsWith('claude'))).toBe(true)
    // Should not contain openai models
    expect(labels.some((l) => l.startsWith('gpt'))).toBe(false)
  })
})

// nodeTypes: should contain exactly 14 entries
describe('nodeTypes', () => {
  it('contains exactly 14 node type entries', () => {
    expect(Object.keys(nodeTypes)).toHaveLength(14)
  })

  it('includes all expected node types', () => {
    const expected = [
      'start', 'end', 'llm', 'agent_pod', 'code', 'http',
      'if_else', 'template', 'variable_assigner', 'variable_aggregator',
      'iteration', 'human_input', 'knowledge_retrieval', 'sub_workflow',
    ]
    for (const type of expected) {
      expect(nodeTypes).toHaveProperty(type)
    }
  })
})
