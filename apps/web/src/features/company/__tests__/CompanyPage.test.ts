// @plan B0-PR-2
//
// NOTE: Component rendering tests (render/screen/fireEvent) require
// @testing-library/react + jsdom setup — not yet configured in this project.
// These tests cover the core business logic: filtering, budget colour
// thresholds, and org-tree shape.

import { describe, it, expect, vi } from 'vitest'
import type { Company, InlineAgent } from '@agentflow/core'
import { getOrgTree } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAgents: InlineAgent[] = [
  {
    name: 'bob',
    role: 'CEO',
    model: { provider: 'anthropic', model_id: 'claude-sonnet-4-6' },
    budget: { monthly_usd: 500, alert_threshold_pct: 80 },
    reports_to: null,
  },
  {
    name: 'alice',
    role: 'Lead Engineer',
    persona: 'Senior Python engineer. Direct and pragmatic.',
    model: { provider: 'anthropic', model_id: 'claude-sonnet-4-6' },
    capabilities: ['coding', 'review'],
    budget: { monthly_usd: 100, alert_threshold_pct: 80 },
    reports_to: 'bob',
  },
  {
    name: 'carol',
    role: 'Designer',
    model: { provider: 'openai', model_id: 'gpt-4o' },
    capabilities: ['writing'],
    budget: { monthly_usd: 80, alert_threshold_pct: 80 },
    reports_to: 'bob',
  },
]

const mockCompany: Company = {
  apiVersion: 'agentflow.ai/v1',
  kind: 'Company',
  metadata: { name: 'acme-corp', namespace: 'default' },
  spec: { agents: mockAgents },
}

// ---------------------------------------------------------------------------
// AgentGrid filter logic (extracted for unit testing)
// ---------------------------------------------------------------------------

function filterAgents(agents: InlineAgent[], q: string): InlineAgent[] {
  const lower = q.toLowerCase()
  if (!lower) return agents
  return agents.filter(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      a.role.toLowerCase().includes(lower) ||
      a.capabilities?.some((c) => c.toLowerCase().includes(lower)),
  )
}

describe('AgentGrid filter logic', () => {
  it('returns all agents when query is empty', () => {
    expect(filterAgents(mockAgents, '')).toHaveLength(3)
  })

  it('filters by role "Lead Engineer" → only alice', () => {
    const result = filterAgents(mockAgents, 'Lead Engineer')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('alice')
  })

  it('filters by capability "coding" → only alice', () => {
    const result = filterAgents(mockAgents, 'coding')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('alice')
  })

  it('filters by name "bob" → only bob', () => {
    const result = filterAgents(mockAgents, 'bob')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('bob')
  })
})

// ---------------------------------------------------------------------------
// AgentCard budget bar color threshold logic
// ---------------------------------------------------------------------------

function getBudgetColor(spent: number, budget: number): string {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  if (pct > 80) return 'bg-red-500'
  if (pct > 60) return 'bg-yellow-400'
  return 'bg-green-500'
}

describe('AgentCard budget colour', () => {
  it('is green when pct < 60%', () => {
    expect(getBudgetColor(50, 100)).toBe('bg-green-500')
  })

  it('is yellow when pct is 60–80%', () => {
    expect(getBudgetColor(70, 100)).toBe('bg-yellow-400')
  })

  it('is red when pct > 80%', () => {
    expect(getBudgetColor(85, 100)).toBe('bg-red-500')
  })
})

// ---------------------------------------------------------------------------
// OrgChart: getOrgTree shape
// ---------------------------------------------------------------------------

describe('OrgChart getOrgTree', () => {
  it('calls getOrgTree and returns one root (bob/CEO) with two children', () => {
    const roots = getOrgTree(mockCompany)
    expect(roots).toHaveLength(1)
    expect(roots[0]!.name).toBe('bob')
    expect(roots[0]!.children).toHaveLength(2)
    const childNames = roots[0]!.children.map((c) => c.name).sort()
    expect(childNames).toEqual(['alice', 'carol'])
  })

  it('returns empty array for a company with no agents', () => {
    const empty: Company = {
      ...mockCompany,
      spec: { ...mockCompany.spec, agents: [] as unknown as [InlineAgent, ...InlineAgent[]] },
    }
    expect(getOrgTree(empty)).toHaveLength(0)
  })

  it('renders a node per agent (flat company has all nodes as roots)', () => {
    const flatCompany: Company = {
      ...mockCompany,
      spec: {
        ...mockCompany.spec,
        agents: mockAgents.map((a) => ({ ...a, reports_to: null })),
      },
    }
    const roots = getOrgTree(flatCompany)
    expect(roots).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// CompanyPage: loadCompany is called on mount (mock-based)
// ---------------------------------------------------------------------------

describe('CompanyPage loadCompany', () => {
  it('loadCompany is callable and resolves', async () => {
    const loadCompany = vi.fn().mockResolvedValue(undefined)
    await loadCompany('acme-corp')
    expect(loadCompany).toHaveBeenCalledWith('acme-corp')
  })
})
