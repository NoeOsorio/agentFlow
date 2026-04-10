import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { validatePipeline, compileEdges, parseMultiDocument } from '../parser/index'

const examplesDir = join(__dirname, '../../examples')

function loadExample(name: string): string {
  return readFileSync(join(examplesDir, name), 'utf-8')
}

describe('example YAML files', () => {
  it('simple-pipeline.yaml validates successfully', () => {
    const result = validatePipeline(loadExample('simple-pipeline.yaml'))
    expect(result.success).toBe(true)
  })

  it('agent-pipeline.yaml validates successfully', () => {
    const result = validatePipeline(loadExample('agent-pipeline.yaml'))
    expect(result.success).toBe(true)
  })

  it('agent-pipeline.yaml uses agent_ref with name (not plain string)', () => {
    const result = validatePipeline(loadExample('agent-pipeline.yaml'))
    expect(result.success).toBe(true)
    if (!result.success) return
    const agentPodNodes = result.data.spec.nodes.filter((n) => n.type === 'agent_pod')
    expect(agentPodNodes.length).toBeGreaterThan(0)
    for (const node of agentPodNodes) {
      if (node.type === 'agent_pod') {
        expect(typeof node.agent_ref).toBe('object')
        expect(typeof node.agent_ref.name).toBe('string')
      }
    }
  })

  it('branching-pipeline.yaml validates and compiles without errors', () => {
    const yaml = loadExample('branching-pipeline.yaml')
    const result = validatePipeline(yaml)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(() => compileEdges(result.data)).not.toThrow()
  })

  it('parallel-pipeline.yaml compileEdges produces 3 parallel LLM nodes as non-entry aggregator', () => {
    const yaml = loadExample('parallel-pipeline.yaml')
    const result = validatePipeline(yaml)
    expect(result.success).toBe(true)
    if (!result.success) return
    const graph = compileEdges(result.data)
    // start is the single entry point
    expect(graph.entryPoints).toEqual(['start'])
    // The 3 LLM nodes all depend only on start
    const llmIds = ['llm_perspective_1', 'llm_perspective_2', 'llm_perspective_3']
    for (const id of llmIds) {
      expect(graph.nodes[id].dependsOn).toEqual(['start'])
    }
    // aggregator depends on all 3
    expect(graph.nodes['aggregator'].dependsOn).toHaveLength(3)
  })

  it('full-manifest.yaml parseMultiDocument returns 2 resources with correct kinds', () => {
    const yaml = loadExample('full-manifest.yaml')
    const resources = parseMultiDocument(yaml)
    expect(resources).toHaveLength(2)
    expect(resources[0].kind).toBe('Company')
    expect(resources[1].kind).toBe('Pipeline')
  })
})
