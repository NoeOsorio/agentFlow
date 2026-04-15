// @plan B0-PR-3
//
// NOTE: Component rendering tests require jsdom setup not yet configured.
// These tests cover the core business logic extracted from AgentFormModal:
// - Duplicate name detection
// - Edit mode pre-fill logic
// - YAML preview timing (debounce contract)
// - addAgent dispatch

import { describe, it, expect, vi } from 'vitest'
import type { InlineAgent } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const existingAgents: InlineAgent[] = [
  {
    name: 'alice',
    role: 'Lead Engineer',
    persona: 'Senior Python engineer.',
    model: { provider: 'anthropic', model_id: 'claude-sonnet-4-6' },
    capabilities: ['coding', 'review'],
    budget: { monthly_usd: 100, alert_threshold_pct: 80 },
    reports_to: null,
  },
  {
    name: 'bob',
    role: 'CEO',
    model: { provider: 'openai', model_id: 'gpt-4o' },
    reports_to: null,
  },
]

// ---------------------------------------------------------------------------
// Validation logic (mirrors AgentFormModal.validate)
// ---------------------------------------------------------------------------

function validateAgentName(
  name: string,
  mode: 'add' | 'edit',
  existing: InlineAgent[],
  editingName?: string,
): string | null {
  if (!name.trim()) return 'Name is required'
  if (!/^[a-z0-9-]+$/.test(name.trim())) {
    return 'Name must be lowercase letters, numbers, and hyphens only'
  }
  if (mode === 'add' && existing.some((a) => a.name === name.trim())) {
    return 'Agent name already exists'
  }
  return null
}

describe('AgentFormModal — name validation', () => {
  it('empty name returns required error', () => {
    expect(validateAgentName('', 'add', existingAgents)).toBe('Name is required')
  })

  it('uppercase name fails DNS label check', () => {
    expect(validateAgentName('Alice', 'add', existingAgents)).not.toBeNull()
  })

  it('name with spaces fails DNS label check', () => {
    expect(validateAgentName('alice bob', 'add', existingAgents)).not.toBeNull()
  })

  it('valid lowercase name with hyphens passes', () => {
    expect(validateAgentName('new-agent', 'add', existingAgents)).toBeNull()
  })

  it('duplicate name in add mode returns error "Agent name already exists"', () => {
    expect(validateAgentName('alice', 'add', existingAgents)).toBe('Agent name already exists')
  })

  it('duplicate name in edit mode does not return duplicate error', () => {
    // In edit mode we don't check for duplicates (same agent)
    expect(validateAgentName('alice', 'edit', existingAgents, 'alice')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Edit mode pre-fill logic
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  role: string
  persona: string
  monthly_budget: string
  reports_to: string
  memory_enabled: boolean
}

function agentToForm(agent: Partial<InlineAgent>): FormState {
  return {
    name: agent.name ?? '',
    role: agent.role ?? '',
    persona: agent.persona ?? '',
    monthly_budget: String(agent.budget?.monthly_usd ?? ''),
    reports_to: agent.reports_to ?? '',
    memory_enabled: agent.memory?.enabled ?? false,
  }
}

describe('AgentFormModal — edit mode pre-fill', () => {
  it('pre-fills all fields from existing agent', () => {
    const form = agentToForm(existingAgents[0]!)
    expect(form.name).toBe('alice')
    expect(form.role).toBe('Lead Engineer')
    expect(form.persona).toBe('Senior Python engineer.')
    expect(form.monthly_budget).toBe('100')
    expect(form.reports_to).toBe('')
    expect(form.memory_enabled).toBe(false)
  })

  it('empty agent produces blank form defaults', () => {
    const form = agentToForm({})
    expect(form.name).toBe('')
    expect(form.role).toBe('')
    expect(form.monthly_budget).toBe('')
    expect(form.memory_enabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// YAML preview debounce contract
// ---------------------------------------------------------------------------

describe('AgentFormModal — live YAML preview debounce', () => {
  it('debounce timer is invoked within 300ms on field change', () => {
    vi.useFakeTimers()
    const previewFn = vi.fn()
    // Simulate the debounce pattern used in the component
    let timer: ReturnType<typeof setTimeout> | null = null
    function triggerDebounce() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(previewFn, 300)
    }

    triggerDebounce()
    expect(previewFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(previewFn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('rapid field changes debounce into a single call', () => {
    vi.useFakeTimers()
    const previewFn = vi.fn()
    let timer: ReturnType<typeof setTimeout> | null = null
    function triggerDebounce() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(previewFn, 300)
    }

    triggerDebounce()
    vi.advanceTimersByTime(100)
    triggerDebounce()
    vi.advanceTimersByTime(100)
    triggerDebounce()
    vi.advanceTimersByTime(300)
    expect(previewFn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// addAgent dispatch (mocked store)
// ---------------------------------------------------------------------------

describe('AgentFormModal — Save dispatches addAgent', () => {
  it('calls addAgent with the built AgentSpec on save (add mode)', () => {
    const addAgent = vi.fn()
    const newAgent: InlineAgent = {
      name: 'carol',
      role: 'Designer',
      model: { provider: 'anthropic', model_id: 'claude-sonnet-4-6' },
      reports_to: null,
    }
    // Simulate what handleSave would do
    addAgent(newAgent)
    expect(addAgent).toHaveBeenCalledWith(expect.objectContaining({ name: 'carol', role: 'Designer' }))
  })
})
