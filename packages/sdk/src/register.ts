import type { AgentPodConfig } from './types'

const _registry = new Map<string, AgentPodConfig>()

/**
 * Register an agent with the AgentFlow SDK.
 * Placeholder — full implementation connects to the AgentFlow API in Phase 4.
 */
export function registerAgent(config: AgentPodConfig): void {
  if (_registry.has(config.name)) {
    console.warn(`[AgentFlow SDK] Agent "${config.name}" is already registered. Overwriting.`)
  }
  _registry.set(config.name, config)
}

/**
 * Get all registered agents.
 */
export function listAgents(): AgentPodConfig[] {
  return Array.from(_registry.values())
}
