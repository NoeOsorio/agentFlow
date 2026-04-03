import type { Pipeline } from '@agentflow/core'

/**
 * Configuration for registering an external AgentPod with AgentFlow.
 * Used by the TypeScript SDK to declare agent capabilities.
 */
export interface AgentPodConfig {
  /** Unique agent identifier — must match the `name` in the pipeline YAML */
  name: string
  /** Human-readable description */
  description?: string
  /** Semantic version of this agent implementation */
  version: string
  /** Input schema (JSON Schema format) */
  inputSchema?: Record<string, unknown>
  /** Output schema (JSON Schema format) */
  outputSchema?: Record<string, unknown>
}
