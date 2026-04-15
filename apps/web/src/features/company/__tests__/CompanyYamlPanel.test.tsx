// @plan B0-PR-3
//
// NOTE: Component rendering tests require jsdom setup not yet configured.
// These tests cover CompanyYamlPanel business logic:
// - Invalid YAML should not update company state
// - Valid YAML with new agent updates agents list
// - Debounce contract (300ms)

import { describe, it, expect, vi } from 'vitest'
import { validateResource, parseResource } from '@agentflow/core'
import type { Company } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_YAML = `\
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
  namespace: default
spec:
  agents:
    - name: alice
      role: Lead Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
`

const VALID_YAML_WITH_NEW_AGENT = `\
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
  namespace: default
spec:
  agents:
    - name: alice
      role: Lead Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
    - name: bob
      role: CEO
      model:
        provider: openai
        model_id: gpt-4o
`

const INVALID_YAML = `\
this is: not: valid: yaml:
  [broken
`

// ---------------------------------------------------------------------------
// setYamlSpec logic (mirrors companyStore.setYamlSpec)
// ---------------------------------------------------------------------------

interface StoreState {
  company: Company | null
  yamlSpec: string
  yamlValid: boolean
  yamlErrors: string[]
}

function applyYaml(current: StoreState, yaml: string): StoreState {
  const result = validateResource(yaml)
  if (!result.success) {
    const messages =
      'errors' in result.error
        ? result.error.errors.map((e: { message: string }) => e.message)
        : [result.error.message]
    return { ...current, yamlSpec: yaml, yamlValid: false, yamlErrors: messages }
  }
  const company = parseResource(yaml) as Company
  return {
    yamlSpec: yaml,
    yamlValid: true,
    yamlErrors: [],
    company,
  }
}

describe('CompanyYamlPanel — YAML validation', () => {
  it('invalid YAML sets yamlValid=false and preserves existing company', () => {
    const initial: StoreState = {
      company: null,
      yamlSpec: '',
      yamlValid: false,
      yamlErrors: [],
    }
    const next = applyYaml(initial, INVALID_YAML)
    expect(next.yamlValid).toBe(false)
    expect(next.yamlErrors.length).toBeGreaterThan(0)
    expect(next.company).toBeNull() // existing company unchanged
  })

  it('valid YAML parses and sets company correctly', () => {
    const initial: StoreState = { company: null, yamlSpec: '', yamlValid: false, yamlErrors: [] }
    const next = applyYaml(initial, VALID_YAML)
    expect(next.yamlValid).toBe(true)
    expect(next.yamlErrors).toHaveLength(0)
    expect(next.company?.metadata.name).toBe('acme-corp')
    expect(next.company?.spec.agents).toHaveLength(1)
  })

  it('valid YAML with new agent: company.spec.agents is updated', () => {
    const initial: StoreState = { company: null, yamlSpec: '', yamlValid: false, yamlErrors: [] }
    const next = applyYaml(initial, VALID_YAML_WITH_NEW_AGENT)
    expect(next.company?.spec.agents).toHaveLength(2)
    const names = next.company!.spec.agents.map((a) => a.name).sort()
    expect(names).toEqual(['alice', 'bob'])
  })
})

// ---------------------------------------------------------------------------
// Debounce contract (mirrors handleChange in CompanyYamlPanel)
// ---------------------------------------------------------------------------

describe('CompanyYamlPanel — debounce 300ms', () => {
  it('setYamlSpec is called after 300ms, not immediately', () => {
    vi.useFakeTimers()
    const setYamlSpec = vi.fn()
    let debounceRef: ReturnType<typeof setTimeout> | null = null

    function handleChange(value: string) {
      if (debounceRef) clearTimeout(debounceRef)
      debounceRef = setTimeout(() => setYamlSpec(value), 300)
    }

    handleChange(VALID_YAML)
    expect(setYamlSpec).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(setYamlSpec).toHaveBeenCalledWith(VALID_YAML)
    vi.useRealTimers()
  })
})
