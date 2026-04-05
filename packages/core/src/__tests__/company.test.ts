import { describe, it, expect } from 'vitest'
import {
  CompanySchema,
  resolveAgent,
  getOrgTree,
  getAgentsByCapability,
} from '../schema/company'
import { serializeResource, parseResource } from '../parser/index'
import type { Company } from '../schema/company'

const ACME_YAML = `
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
  namespace: default
  labels:
    industry: software
spec:
  description: "AI-first software company"
  policy:
    max_monthly_budget_usd: 500
    require_approval_above_usd: 50
  agents:
    - name: bob
      role: CEO
      persona: "Strategic visionary."
      model:
        provider: anthropic
        model_id: claude-opus-4-6
      budget:
        monthly_usd: 150
      capabilities: [planning, management]
      reports_to: null
    - name: alice
      role: Lead Engineer
      persona: "Senior Python engineer."
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      budget:
        monthly_usd: 100
      capabilities: [coding, review]
      reports_to: bob
    - name: carol
      role: UX Designer
      persona: "User-empathy first."
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      budget:
        monthly_usd: 80
      capabilities: [writing, analysis]
      reports_to: bob
  departments:
    - name: engineering
      agent_names: [alice]
    - name: design
      agent_names: [carol]
`

describe('Company Schema', () => {
  it('parses Company YAML with 3 agents — all fields correctly typed', () => {
    const company = parseResource(ACME_YAML) as Company
    expect(company.kind).toBe('Company')
    expect(company.metadata.name).toBe('acme-corp')
    expect(company.spec.agents).toHaveLength(3)
    expect(company.spec.agents[0]!.name).toBe('bob')
    expect(company.spec.agents[0]!.role).toBe('CEO')
    expect(company.spec.agents[1]!.model.provider).toBe('anthropic')
    expect(company.spec.departments).toHaveLength(2)
    expect(company.spec.policy?.max_monthly_budget_usd).toBe(500)
  })

  it('validates required fields (metadata.name, spec.agents not empty)', () => {
    const result = CompanySchema.safeParse({
      apiVersion: 'agentflow.ai/v1',
      kind: 'Company',
      metadata: { name: 'test' },
      spec: { agents: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects Company with negative budget.monthly_usd', () => {
    const result = CompanySchema.safeParse({
      apiVersion: 'agentflow.ai/v1',
      kind: 'Company',
      metadata: { name: 'test' },
      spec: {
        agents: [
          {
            name: 'a',
            role: 'CEO',
            model: { provider: 'anthropic', model_id: 'claude-sonnet-4-6' },
            budget: { monthly_usd: -10 },
          },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it('resolveAgent("alice") returns correct agent spec', () => {
    const company = parseResource(ACME_YAML) as Company
    const alice = resolveAgent(company, 'alice')
    expect(alice).toBeDefined()
    expect(alice!.role).toBe('Lead Engineer')
    expect(alice!.capabilities).toContain('coding')
  })

  it('resolveAgent returns undefined for unknown agent', () => {
    const company = parseResource(ACME_YAML) as Company
    expect(resolveAgent(company, 'dave')).toBeUndefined()
  })

  it('getOrgTree() builds correct tree: CEO at root, alice and carol as children', () => {
    const company = parseResource(ACME_YAML) as Company
    const tree = getOrgTree(company)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.name).toBe('bob')
    expect(tree[0]!.role).toBe('CEO')
    expect(tree[0]!.children).toHaveLength(2)
    const childNames = tree[0]!.children.map((c) => c.name).sort()
    expect(childNames).toEqual(['alice', 'carol'])
  })

  it('getAgentsByCapability(company, "coding") returns only agents with that capability', () => {
    const company = parseResource(ACME_YAML) as Company
    const coders = getAgentsByCapability(company, 'coding')
    expect(coders).toHaveLength(1)
    expect(coders[0]!.name).toBe('alice')
  })

  it('round-trip: serialize then parse gives identical object', () => {
    const company = parseResource(ACME_YAML) as Company
    const yaml = serializeResource(company)
    const reparsed = parseResource(yaml) as Company
    expect(reparsed).toEqual(company)
  })
})
