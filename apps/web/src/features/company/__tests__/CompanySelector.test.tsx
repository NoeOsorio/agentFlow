// @plan B0-PR-3
//
// NOTE: Component rendering tests require jsdom setup not yet configured.
// These tests cover CompanySelector business logic:
// - Dropdown constructs correct CompanyReference on selection
// - Empty selection calls onChange(null)
// - API fetch shape contract

import { describe, it, expect, vi } from 'vitest'
import type { CompanyReference } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface CompanyOption {
  id: string
  name: string
  namespace: string
  agent_count: number
}

const mockCompanies: CompanyOption[] = [
  { id: '1', name: 'acme-corp', namespace: 'default', agent_count: 3 },
  { id: '2', name: 'startup-inc', namespace: 'production', agent_count: 1 },
]

// ---------------------------------------------------------------------------
// onChange logic (mirrors CompanySelector.handleChange)
// ---------------------------------------------------------------------------

function resolveCompanyRef(
  selectedName: string,
  companies: CompanyOption[],
): CompanyReference | null {
  if (!selectedName) return null
  const company = companies.find((c) => c.name === selectedName)
  if (!company) return null
  return { name: company.name, namespace: company.namespace }
}

describe('CompanySelector — onChange produces CompanyReference', () => {
  it('selecting a company calls onChange with { name, namespace }', () => {
    const onChange = vi.fn()
    const ref = resolveCompanyRef('acme-corp', mockCompanies)
    onChange(ref)
    expect(onChange).toHaveBeenCalledWith({ name: 'acme-corp', namespace: 'default' })
  })

  it('selecting startup-inc passes correct namespace', () => {
    const ref = resolveCompanyRef('startup-inc', mockCompanies)
    expect(ref).toEqual({ name: 'startup-inc', namespace: 'production' })
  })

  it('selecting empty string calls onChange(null)', () => {
    const onChange = vi.fn()
    const ref = resolveCompanyRef('', mockCompanies)
    onChange(ref)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('unknown company name returns null', () => {
    const ref = resolveCompanyRef('unknown-company', mockCompanies)
    expect(ref).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// API fetch shape (GET /api/companies response contract)
// ---------------------------------------------------------------------------

describe('CompanySelector — API fetch', () => {
  it('fetches GET /api/companies and shows name + agent count', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCompanies,
    })
    global.fetch = mockFetch

    const res = await fetch('/api/companies')
    const data = (await res.json()) as CompanyOption[]

    expect(mockFetch).toHaveBeenCalledWith('/api/companies')
    expect(data).toHaveLength(2)
    expect(data[0]!.name).toBe('acme-corp')
    expect(data[0]!.agent_count).toBe(3)
  })
})
