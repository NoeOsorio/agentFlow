// @plan B3-PR-1
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCompanyStore } from '../companyStore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_YAML = `\
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: test-company
  namespace: default
spec:
  agents:
    - name: alice
      role: Developer
      model:
        provider: anthropic
        model_id: claude-3-5-sonnet-20241022
`

const VALID_YAML_TWO_AGENTS = `\
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: test-company
  namespace: default
spec:
  agents:
    - name: alice
      role: Developer
      model:
        provider: anthropic
        model_id: claude-3-5-sonnet-20241022
    - name: bob
      role: Reviewer
      model:
        provider: openai
        model_id: gpt-4o
`

const INVALID_YAML = `not: valid: yaml: [[[ oops`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initialState = {
  companyId: null,
  companyName: '',
  namespace: 'default',
  company: null,
  saveStatus: 'idle' as const,
  yamlSpec: '',
  yamlValid: false,
  yamlErrors: [],
  agentBudgets: {},
  agentHealth: {},
}

beforeEach(() => {
  useCompanyStore.setState(initialState)
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// setYamlSpec
// ---------------------------------------------------------------------------

describe('setYamlSpec', () => {
  it('parses valid Company YAML and updates company.spec.agents', () => {
    const { setYamlSpec } = useCompanyStore.getState()
    setYamlSpec(VALID_YAML)

    const { company, yamlValid, yamlErrors, companyName, namespace } =
      useCompanyStore.getState()
    expect(yamlValid).toBe(true)
    expect(yamlErrors).toHaveLength(0)
    expect(company).not.toBeNull()
    expect(company!.spec.agents).toHaveLength(1)
    expect(company!.spec.agents[0]?.name).toBe('alice')
    expect(companyName).toBe('test-company')
    expect(namespace).toBe('default')
  })

  it('sets yamlErrors without clearing company when YAML is invalid', () => {
    // First load a valid company
    useCompanyStore.getState().setYamlSpec(VALID_YAML)
    const validCompany = useCompanyStore.getState().company

    // Then apply invalid YAML
    useCompanyStore.getState().setYamlSpec(INVALID_YAML)

    const { company, yamlValid, yamlErrors } = useCompanyStore.getState()
    expect(yamlValid).toBe(false)
    expect(yamlErrors.length).toBeGreaterThan(0)
    // Company from valid state is preserved
    expect(company).toStrictEqual(validCompany)
  })

  it('updates companyName and namespace from metadata', () => {
    useCompanyStore.getState().setYamlSpec(VALID_YAML_TWO_AGENTS)
    const { companyName, namespace } = useCompanyStore.getState()
    expect(companyName).toBe('test-company')
    expect(namespace).toBe('default')
  })
})

// ---------------------------------------------------------------------------
// addAgent
// ---------------------------------------------------------------------------

describe('addAgent', () => {
  it('serializes back to valid YAML and new agent appears in yamlSpec', () => {
    vi.useFakeTimers()
    useCompanyStore.getState().setYamlSpec(VALID_YAML)

    useCompanyStore.getState().addAgent({
      name: 'charlie',
      role: 'Designer',
      model: { provider: 'anthropic', model_id: 'claude-3-5-sonnet-20241022' },
    })

    const { yamlSpec, company } = useCompanyStore.getState()
    expect(yamlSpec).toContain('charlie')
    expect(company!.spec.agents).toHaveLength(2)
    expect(company!.spec.agents[1]?.name).toBe('charlie')
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// updateAgent
// ---------------------------------------------------------------------------

describe('updateAgent', () => {
  it('updates only the patched field, leaving the rest intact', () => {
    vi.useFakeTimers()
    useCompanyStore.getState().setYamlSpec(VALID_YAML)

    useCompanyStore.getState().updateAgent('alice', { role: 'CTO' })

    const { company, yamlSpec } = useCompanyStore.getState()
    const alice = company!.spec.agents.find((a) => a.name === 'alice')
    expect(alice?.role).toBe('CTO')
    // model should be untouched
    expect(alice?.model.provider).toBe('anthropic')
    expect(yamlSpec).toContain('CTO')
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// deleteAgent
// ---------------------------------------------------------------------------

describe('deleteAgent', () => {
  it('removes the agent and re-serializes; company.spec.agents no longer contains the agent', () => {
    vi.useFakeTimers()
    useCompanyStore.getState().setYamlSpec(VALID_YAML_TWO_AGENTS)

    useCompanyStore.getState().deleteAgent('alice')

    const { company, yamlSpec } = useCompanyStore.getState()
    expect(company!.spec.agents).toHaveLength(1)
    expect(company!.spec.agents[0]?.name).toBe('bob')
    expect(yamlSpec).not.toContain('alice')
    vi.useRealTimers()
  })
})
