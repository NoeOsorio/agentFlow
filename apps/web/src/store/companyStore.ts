/**
 * @plan B3-PR-1
 * CompanyStore — Zustand store for company/agent state.
 * Hooks useAgentBudget and useAgentHealth are part of B3-PR-3.
 */

import { create } from 'zustand'
import type { AgentBudgetState, AgentHealthState } from './types'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface CompanyStoreState {
  companyId: string | null
  companyName: string
  namespace: string
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  yamlSpec: string
  yamlValid: boolean
  yamlErrors: string[]
  agentBudgets: Record<string, AgentBudgetState>
  agentHealth: Record<string, AgentHealthState>
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCompanyStore = create<CompanyStoreState>(() => ({
  companyId: null,
  companyName: '',
  namespace: 'default',
  saveStatus: 'idle',
  yamlSpec: '',
  yamlValid: true,
  yamlErrors: [],
  agentBudgets: {},
  agentHealth: {},
}))

// ---------------------------------------------------------------------------
// Hooks (B3-PR-3)
// ---------------------------------------------------------------------------

/** Returns the live budget state for a named agent, or undefined if not loaded. */
export function useAgentBudget(agentName: string): AgentBudgetState | undefined {
  return useCompanyStore((s) => s.agentBudgets[agentName])
}

/** Returns the live health state for a named agent, or undefined if not loaded. */
export function useAgentHealth(agentName: string): AgentHealthState | undefined {
  return useCompanyStore((s) => s.agentHealth[agentName])
}
