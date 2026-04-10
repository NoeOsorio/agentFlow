import { describe, it, expect } from 'vitest'
import yaml from 'js-yaml'
import { PipelineResourceSchema } from '../schema/pipeline'
import { parseResource, serializeResource } from '../parser/index'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PIPELINE_YAML = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: ship-feature
  namespace: default
  labels:
    team: engineering
spec:
  company_ref:
    name: acme-corp
    namespace: default
  trigger:
    type: webhook
    source: github
  nodes:
    - id: start
      type: start
    - id: plan
      type: agent_pod
      agent_ref:
        name: alice
      instruction: "Plan the implementation for: {{#start.feature_description#}}"
  edges:
    - source: start
      target: plan
`

const PIPELINE_NO_COMPANY_YAML = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: simple-pipeline
spec:
  nodes: []
  edges: []
`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineResourceSchema', () => {
  it('parses Pipeline YAML with apiVersion/kind/metadata/spec envelope', () => {
    const raw = yaml.load(PIPELINE_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.apiVersion).toBe('agentflow.ai/v1')
    expect(result.data.kind).toBe('Pipeline')
    expect(result.data.metadata.name).toBe('ship-feature')
    expect(result.data.metadata.namespace).toBe('default')
    expect(result.data.metadata.labels?.['team']).toBe('engineering')
  })

  it('validates company_ref field', () => {
    const raw = yaml.load(PIPELINE_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.spec.company_ref).toEqual({ name: 'acme-corp', namespace: 'default' })
  })

  it('parses Pipeline without company_ref (optional)', () => {
    const raw = yaml.load(PIPELINE_NO_COMPANY_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.spec.company_ref).toBeUndefined()
  })

  it('preserves nodes and edges arrays', () => {
    const raw = yaml.load(PIPELINE_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.spec.nodes).toHaveLength(2)
    expect(result.data.spec.edges).toHaveLength(1)
  })

  it('round-trip: serialize → parse produces identical output', () => {
    const resource = parseResource(PIPELINE_YAML)
    const serialized = serializeResource(resource)
    const reparsed = parseResource(serialized)
    expect(reparsed).toEqual(resource)
  })

  it('rejects invalid apiVersion', () => {
    const raw = yaml.load(PIPELINE_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse({ ...raw, apiVersion: 'invalid/v99' })
    expect(result.success).toBe(false)
  })

  it('rejects wrong kind', () => {
    const raw = yaml.load(PIPELINE_YAML) as Record<string, unknown>
    const result = PipelineResourceSchema.safeParse({ ...raw, kind: 'Company' })
    expect(result.success).toBe(false)
  })
})
