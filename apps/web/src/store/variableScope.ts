/**
 * @plan B3-PR-4
 * computeVariableScope — pure function: topological sort + upstream variable derivation.
 * No side effects, no store imports; testable in isolation.
 */

import { useMemo } from 'react'
import type { PipelineNode } from '@agentflow/core'
import type { VariableType } from '@agentflow/core'
import { usePipelineStore } from './pipelineStore'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AvailableVariable {
  node_id: string
  variable: string
  path?: string[]
  type: VariableType
  description?: string
}

// Minimal structural interfaces so this function is testable without
// constructing full @xyflow/react Node / Edge objects.
interface NodeLike {
  id: string
  data: PipelineNode
}

interface EdgeLike {
  source: string
  target: string
}

// ---------------------------------------------------------------------------
// Fixed output schemas per node type
// ---------------------------------------------------------------------------

type OutputSpec = Omit<AvailableVariable, 'node_id'>

const FIXED_OUTPUTS: Partial<Record<PipelineNode['type'], OutputSpec[]>> = {
  agent_pod: [
    { variable: 'response', type: 'string', description: 'Agent response text' },
    { variable: 'agent_name', type: 'string', description: 'Name of the executing agent' },
    { variable: 'agent_role', type: 'string', description: 'Role of the executing agent' },
  ],
  llm: [
    { variable: 'text', type: 'string', description: 'LLM output text' },
    { variable: 'tokens_used', type: 'number', description: 'Total tokens consumed' },
  ],
  http: [
    { variable: 'status_code', type: 'number', description: 'HTTP response status code' },
    { variable: 'body', type: 'object', description: 'HTTP response body' },
    { variable: 'headers', type: 'object', description: 'HTTP response headers' },
  ],
  template: [
    { variable: 'text', type: 'string', description: 'Rendered template text' },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derives the declared outputs for a node. */
function deriveNodeOutputs(node: NodeLike): OutputSpec[] {
  const d = node.data

  if (d.type === 'start') {
    return (d.outputs ?? []).map((def) => ({
      variable: def.key,
      type: def.type,
      description: def.description,
    }))
  }

  if (d.type === 'code') {
    return (d.outputs ?? []).map((def) => ({
      variable: def.key,
      type: def.type,
      description: def.description,
    }))
  }

  return FIXED_OUTPUTS[d.type] ?? []
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Returns all variables available at `forNodeId` — i.e. the combined outputs
 * of every upstream ancestor node, ordered by topological rank.
 *
 * Returns `[]` silently when:
 * - `forNodeId` is not in the graph
 * - The graph contains a cycle (the error is already caught by `_validatePipeline`)
 */
export function computeVariableScope(
  nodes: NodeLike[],
  edges: EdgeLike[],
  forNodeId: string,
): AvailableVariable[] {
  const nodeIds = new Set(nodes.map((n) => n.id))

  if (!nodeIds.has(forNodeId)) return []

  // Build forward and reverse adjacency sets
  const forward = new Map<string, Set<string>>()
  const reverse = new Map<string, Set<string>>()

  for (const id of nodeIds) {
    forward.set(id, new Set())
    reverse.set(id, new Set())
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    forward.get(edge.source)!.add(edge.target)
    reverse.get(edge.target)!.add(edge.source)
  }

  // Kahn's topological sort — cycle detection
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) {
    inDegree.set(id, reverse.get(id)!.size)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    topoOrder.push(curr)
    for (const next of forward.get(curr)!) {
      const newDeg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  if (topoOrder.length !== nodeIds.size) {
    console.warn('[variableScope] Cycle detected in pipeline graph — returning empty scope')
    return []
  }

  // BFS backwards from forNodeId to collect all ancestor node IDs
  const ancestors = new Set<string>()
  const visited = new Set<string>([forNodeId])
  const bfsQueue: string[] = [forNodeId]

  while (bfsQueue.length > 0) {
    const curr = bfsQueue.shift()!
    for (const src of reverse.get(curr)!) {
      if (!visited.has(src)) {
        visited.add(src)
        ancestors.add(src)
        bfsQueue.push(src)
      }
    }
  }

  // Derive outputs for each ancestor, preserving topological order
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const result: AvailableVariable[] = []

  for (const id of topoOrder) {
    if (!ancestors.has(id)) continue
    const node = nodeMap.get(id)!
    for (const out of deriveNodeOutputs(node)) {
      result.push({ node_id: id, ...out })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Returns upstream variables available at the given node.
 * Memoized against nodes and edges changes.
 */
export function useVariableScope(nodeId: string): AvailableVariable[] {
  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
  return useMemo(() => computeVariableScope(nodes, edges, nodeId), [nodes, edges, nodeId])
}
