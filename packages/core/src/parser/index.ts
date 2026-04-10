import yaml from 'js-yaml'
import { z, ZodError } from 'zod'
import { PipelineSchema, PipelineResourceSchema } from '../schema/pipeline'
import { CompanySchema } from '../schema/company'
import { AgentSchema } from '../schema/agent'
import type { BaseResource } from '../schema/resource'
import type { Pipeline } from '../schema/pipeline'
import type { PipelineNode } from '../schema/nodes'
import { resolveVariableRefs as resolveVarRefsOnObject } from '../schema/variable'

// ---------------------------------------------------------------------------
// Schema Registry (dispatches by `kind`)
// ---------------------------------------------------------------------------

const schemas: Record<string, z.ZodType> = {
  Company: CompanySchema,
  Agent: AgentSchema,
  Pipeline: PipelineSchema,
}

// ---------------------------------------------------------------------------
// Kind Extraction
// ---------------------------------------------------------------------------

export function getKind(yamlString: string): string | null {
  const match = /^kind:\s*(.+)$/m.exec(yamlString)
  const captured = match?.[1]
  return captured ? captured.trim().replace(/^["']|["']$/g, '') : null
}

// ---------------------------------------------------------------------------
// Single-Resource Parsing
// ---------------------------------------------------------------------------

export function parseResource(yamlString: string): BaseResource {
  const raw = yaml.load(yamlString) as Record<string, unknown>
  const kind = typeof raw?.kind === 'string' ? raw.kind : null
  if (!kind || !schemas[kind]) {
    throw new Error(`Unknown or missing resource kind: ${kind}`)
  }
  return schemas[kind].parse(raw) as BaseResource
}

// ---------------------------------------------------------------------------
// Multi-Document Parsing
// ---------------------------------------------------------------------------

export function parseMultiDocument(yamlString: string): BaseResource[] {
  const docs = yaml.loadAll(yamlString) as Record<string, unknown>[]
  return docs.map((doc) => {
    const kind = typeof doc?.kind === 'string' ? doc.kind : null
    if (!kind || !schemas[kind]) {
      throw new Error(`Unknown or missing resource kind: ${kind}`)
    }
    return schemas[kind].parse(doc) as BaseResource
  })
}

// ---------------------------------------------------------------------------
// Validation (safe — no throw)
// ---------------------------------------------------------------------------

export function validateResource(
  yamlString: string,
): { success: true; data: BaseResource } | { success: false; error: ZodError | Error } {
  try {
    const raw = yaml.load(yamlString) as Record<string, unknown>
    const kind = typeof raw?.kind === 'string' ? raw.kind : null
    if (!kind || !schemas[kind]) {
      return { success: false, error: new Error(`Unknown or missing resource kind: ${kind}`) }
    }
    const result = schemas[kind].safeParse(raw)
    if (result.success) return { success: true, data: result.data as BaseResource }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeResource(resource: BaseResource): string {
  return yaml.dump(resource, { indent: 2, lineWidth: 120 })
}

export function serializeMultiDocument(resources: BaseResource[]): string {
  return resources
    .map((r) => yaml.dump(r, { indent: 2, lineWidth: 120 }))
    .join('---\n')
}

// ---------------------------------------------------------------------------
// Pipeline-specific API (A1-PR-3)
// ---------------------------------------------------------------------------

/**
 * Parse and validate a Pipeline YAML string against the K8s-wrapped schema.
 * Throws a ZodError on validation failure.
 */
export function parsePipeline(yamlString: string): Pipeline {
  const raw = yaml.load(yamlString) as Record<string, unknown>
  if (raw?.kind !== 'Pipeline') {
    throw new Error(`Expected kind: Pipeline, got: ${raw?.kind}`)
  }
  return PipelineResourceSchema.parse(raw)
}

/**
 * Serialize a Pipeline back to YAML with the apiVersion/kind/metadata/spec envelope.
 */
export function serializePipeline(pipeline: Pipeline): string {
  return yaml.dump(pipeline, { indent: 2, lineWidth: 120 })
}

/**
 * Safe-parse a Pipeline YAML string — returns result without throwing.
 */
export function validatePipeline(
  yamlString: string,
): { success: true; data: Pipeline } | { success: false; error: ZodError | Error } {
  try {
    const raw = yaml.load(yamlString) as Record<string, unknown>
    if (raw?.kind !== 'Pipeline') {
      return { success: false, error: new Error(`Expected kind: Pipeline, got: ${raw?.kind}`) }
    }
    const result = PipelineResourceSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/**
 * Walk all node fields in a Pipeline and convert `{{#...#}}` strings to
 * `VariableReference` objects. Returns a new Pipeline (deep clone with refs resolved).
 */
export function resolvePipelineRefs(pipeline: Pipeline): Pipeline {
  return resolveVarRefsOnObject(pipeline) as Pipeline
}

// ---------------------------------------------------------------------------
// CompiledGraph — contract with A2 (runtime executor)
// ---------------------------------------------------------------------------

export type CompiledGraph = {
  nodes: Record<
    string,
    {
      node: PipelineNode
      dependsOn: string[]
      provides: string[]
    }
  >
  entryPoints: string[]
  exitPoints: string[]
}

export class CyclicDependencyError extends Error {
  constructor(cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(' → ')}`)
    this.name = 'CyclicDependencyError'
  }
}

/**
 * Build an adjacency map (CompiledGraph) from a Pipeline's nodes and edges.
 * Detects cycles using Kahn's topological sort algorithm.
 * Identifies entry points (no incoming edges) and exit points (no outgoing edges).
 */
export function compileEdges(pipeline: Pipeline): CompiledGraph {
  const { nodes, edges } = pipeline.spec

  // Build node map
  const nodeMap = new Map<string, PipelineNode>()
  for (const node of nodes) {
    nodeMap.set(node.id, node)
  }

  // Build adjacency structures from edges
  const inDegree = new Map<string, number>()
  const dependsOnMap = new Map<string, string[]>()
  const providesMap = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    dependsOnMap.set(node.id, [])
    providesMap.set(node.id, [])
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      throw new Error(`Edge references unknown source node: ${edge.source}`)
    }
    if (!nodeMap.has(edge.target)) {
      throw new Error(`Edge references unknown target node: ${edge.target}`)
    }

    dependsOnMap.get(edge.target)!.push(edge.source)
    providesMap.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  // Kahn's algorithm — detect cycles
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const processed: string[] = []
  const remaining = new Map(inDegree)

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    processed.push(nodeId)

    for (const successor of providesMap.get(nodeId) ?? []) {
      const newDegree = (remaining.get(successor) ?? 1) - 1
      remaining.set(successor, newDegree)
      if (newDegree === 0) queue.push(successor)
    }
  }

  if (processed.length !== nodes.length) {
    // Find which nodes are part of the cycle
    const cycleNodes = nodes.map((n) => n.id).filter((id) => !processed.includes(id))
    throw new CyclicDependencyError(cycleNodes)
  }

  // Identify entry and exit points
  const entryPoints = nodes.map((n) => n.id).filter((id) => (dependsOnMap.get(id)?.length ?? 0) === 0)
  const exitPoints = nodes.map((n) => n.id).filter((id) => (providesMap.get(id)?.length ?? 0) === 0)

  // Build result
  const result: CompiledGraph['nodes'] = {}
  for (const node of nodes) {
    result[node.id] = {
      node,
      dependsOn: dependsOnMap.get(node.id) ?? [],
      provides: providesMap.get(node.id) ?? [],
    }
  }

  return { nodes: result, entryPoints, exitPoints }
}

// ---------------------------------------------------------------------------
// Legacy API (kept for backward compatibility with existing Pipeline callers)
// ---------------------------------------------------------------------------

/** @deprecated Use `parsePipeline` instead. */
export function parseYAML(yamlString: string): Pipeline {
  const raw = yaml.load(yamlString)
  return PipelineSchema.parse(raw)
}

/** @deprecated Use `serializePipeline` instead. */
export function serializeAST(pipeline: Pipeline): string {
  return yaml.dump(pipeline, { indent: 2, lineWidth: 120 })
}

/** @deprecated Use `validatePipeline` instead. */
export function validateYAML(
  yamlString: string,
): { success: true; data: Pipeline } | { success: false; error: ZodError | Error } {
  try {
    const raw = yaml.load(yamlString)
    const result = PipelineSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}
