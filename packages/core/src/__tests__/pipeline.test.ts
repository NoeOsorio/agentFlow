import { describe, it, expect } from 'vitest'
import yaml from 'js-yaml'
import { PipelineResourceSchema } from '../schema/pipeline'
import {
  parseResource,
  serializeResource,
  parsePipeline,
  serializePipeline,
  validatePipeline,
  compileEdges,
  resolvePipelineRefs,
  CyclicDependencyError,
} from '../parser/index'
import { parseVariableRef, serializeVariableRef } from '../schema/variable'

// ---------------------------------------------------------------------------
// Fixtures — PipelineResourceSchema tests (A1-PR-1/PR-2)
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
      outputs: []
    - id: plan
      type: agent_pod
      agent_ref:
        name: alice
      instruction: "Plan the implementation"
  edges:
    - id: e1
      source: start
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
// PipelineResourceSchema tests
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

// ---------------------------------------------------------------------------
// Fixtures — parser/compileEdges tests (A1-PR-3)
// ---------------------------------------------------------------------------

const THREE_NODE_PIPELINE = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: test-pipeline
  namespace: default
spec:
  nodes:
    - id: start
      type: start
      outputs:
        - key: input_text
          type: string
    - id: process
      type: llm
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      prompt:
        user: "Process input"
    - id: end
      type: end
      inputs:
        - node_id: process
          variable: output
  edges:
    - id: e1
      source: start
      target: process
    - id: e2
      source: process
      target: end
`

const PARALLEL_PIPELINE = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: parallel-pipeline
  namespace: default
spec:
  nodes:
    - id: llm_a
      type: llm
      model:
        provider: openai
        model_id: gpt-4o
      prompt:
        user: "Task A"
    - id: llm_b
      type: llm
      model:
        provider: openai
        model_id: gpt-4o
      prompt:
        user: "Task B"
    - id: aggregator
      type: variable_aggregator
      branches:
        - llm_a
        - llm_b
      output_key: combined
      strategy: merge
  edges:
    - id: e1
      source: llm_a
      target: aggregator
    - id: e2
      source: llm_b
      target: aggregator
`

// ---------------------------------------------------------------------------
// parsePipeline
// ---------------------------------------------------------------------------

describe('parsePipeline', () => {
  it('parses a valid Pipeline YAML with apiVersion/kind/metadata/spec envelope', () => {
    const pipeline = parsePipeline(THREE_NODE_PIPELINE)
    expect(pipeline.apiVersion).toBe('agentflow.ai/v1')
    expect(pipeline.kind).toBe('Pipeline')
    expect(pipeline.metadata.name).toBe('test-pipeline')
    expect(pipeline.spec.nodes).toHaveLength(3)
    expect(pipeline.spec.edges).toHaveLength(2)
  })

  it('rejects YAML with wrong kind', () => {
    const wrongKind = `
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme
spec:
  agents:
    - name: alice
      role: developer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
`
    expect(() => parsePipeline(wrongKind)).toThrow('Expected kind: Pipeline')
  })
})

// ---------------------------------------------------------------------------
// serializePipeline / round-trip
// ---------------------------------------------------------------------------

describe('serializePipeline', () => {
  it('round-trip: parsePipeline → serializePipeline → parsePipeline produces identical output', () => {
    const first = parsePipeline(THREE_NODE_PIPELINE)
    const serialized = serializePipeline(first)
    const second = parsePipeline(serialized)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// validatePipeline
// ---------------------------------------------------------------------------

describe('validatePipeline', () => {
  it('returns success: true for valid YAML', () => {
    const result = validatePipeline(THREE_NODE_PIPELINE)
    expect(result.success).toBe(true)
  })

  it('returns success: false for wrong kind', () => {
    const result = validatePipeline(
      'apiVersion: agentflow.ai/v1\nkind: Agent\nmetadata:\n  name: x\nspec:\n  role: dev\n  model:\n    provider: anthropic\n    model_id: claude-sonnet-4-6',
    )
    expect(result.success).toBe(false)
  })

  it('returns success: false for invalid YAML structure', () => {
    const result = validatePipeline('not: valid: yaml: [')
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// compileEdges — sequential pipeline
// ---------------------------------------------------------------------------

describe('compileEdges — sequential 3-node pipeline', () => {
  it('produces correct entryPoints and exitPoints', () => {
    const pipeline = parsePipeline(THREE_NODE_PIPELINE)
    const graph = compileEdges(pipeline)

    expect(graph.entryPoints).toEqual(['start'])
    expect(graph.exitPoints).toEqual(['end'])
  })

  it('builds correct dependsOn relationships', () => {
    const pipeline = parsePipeline(THREE_NODE_PIPELINE)
    const graph = compileEdges(pipeline)

    expect(graph.nodes['start'].dependsOn).toEqual([])
    expect(graph.nodes['process'].dependsOn).toEqual(['start'])
    expect(graph.nodes['end'].dependsOn).toEqual(['process'])
  })

  it('builds correct provides relationships', () => {
    const pipeline = parsePipeline(THREE_NODE_PIPELINE)
    const graph = compileEdges(pipeline)

    expect(graph.nodes['start'].provides).toEqual(['process'])
    expect(graph.nodes['process'].provides).toEqual(['end'])
    expect(graph.nodes['end'].provides).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// compileEdges — parallel pipeline
// ---------------------------------------------------------------------------

describe('compileEdges — parallel pipeline', () => {
  it('both parallel nodes are in entryPoints, aggregator in exitPoints', () => {
    const pipeline = parsePipeline(PARALLEL_PIPELINE)
    const graph = compileEdges(pipeline)

    expect(graph.entryPoints).toContain('llm_a')
    expect(graph.entryPoints).toContain('llm_b')
    expect(graph.entryPoints).not.toContain('aggregator')
    expect(graph.exitPoints).toEqual(['aggregator'])
  })
})

// ---------------------------------------------------------------------------
// compileEdges — cycle detection
// ---------------------------------------------------------------------------

describe('compileEdges — cycle detection', () => {
  const cyclicYaml = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: cyclic
  namespace: default
spec:
  nodes:
    - id: node_a
      type: llm
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      prompt:
        user: A
    - id: node_b
      type: llm
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      prompt:
        user: B
  edges:
    - id: e1
      source: node_a
      target: node_b
    - id: e2
      source: node_b
      target: node_a
`

  it('throws CyclicDependencyError for A → B → A', () => {
    const pipeline = parsePipeline(cyclicYaml)
    expect(() => compileEdges(pipeline)).toThrowError(CyclicDependencyError)
  })

  it('CyclicDependencyError message includes node IDs', () => {
    const pipeline = parsePipeline(cyclicYaml)
    try {
      compileEdges(pipeline)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CyclicDependencyError)
      const msg = (err as CyclicDependencyError).message
      expect(msg).toMatch(/node_a|node_b/)
    }
  })
})

// ---------------------------------------------------------------------------
// resolvePipelineRefs
// ---------------------------------------------------------------------------

describe('resolvePipelineRefs', () => {
  it('converts {{#llm_1.output.text#}} strings in node fields to VariableReference objects', () => {
    const yamlWithRefs = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: refs-pipeline
  namespace: default
spec:
  nodes:
    - id: llm_1
      type: llm
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      prompt:
        user: First step
    - id: llm_2
      type: llm
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      prompt:
        user: "{{#llm_1.output.text#}}"
  edges:
    - id: e1
      source: llm_1
      target: llm_2
`
    const pipeline = parsePipeline(yamlWithRefs)
    const resolved = resolvePipelineRefs(pipeline)

    const llm2 = resolved.spec.nodes.find((n) => n.id === 'llm_2') as { prompt: { user: unknown } }
    const userPrompt = llm2?.prompt?.user
    expect(userPrompt).toMatchObject({
      node_id: 'llm_1',
      variable: 'output',
      path: ['text'],
    })
  })
})

// ---------------------------------------------------------------------------
// parseVariableRef / serializeVariableRef
// ---------------------------------------------------------------------------

describe('parseVariableRef', () => {
  it('parses {{#llm_1.output.text#}} correctly', () => {
    const ref = parseVariableRef('{{#llm_1.output.text#}}')
    expect(ref).toEqual({ node_id: 'llm_1', variable: 'output', path: ['text'] })
  })

  it('parses {{#start.feature_description#}} (no path) correctly', () => {
    const ref = parseVariableRef('{{#start.feature_description#}}')
    expect(ref).toEqual({ node_id: 'start', variable: 'feature_description', path: [] })
  })

  it('round-trip: parseVariableRef ↔ serializeVariableRef', () => {
    const original = '{{#node_a.result.nested.key#}}'
    const ref = parseVariableRef(original)
    expect(serializeVariableRef(ref)).toBe(original)
  })

  it('throws on invalid syntax', () => {
    expect(() => parseVariableRef('not_a_ref')).toThrow('Invalid variable reference syntax')
  })
})
