// @plan B3-PR-1
// Stub — full implementation lives in B3-PR-1 (CompanyStore + YAML sync).
// This file provides the minimal interface that pipelineStore needs to
// perform agent-ref validation and surface budget / health hooks.
import { create } from 'zustand'
import type { AgentBudgetState, AgentHealthState } from './types'
import type { Company } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Minimal state shape consumed by pipelineStore
// ---------------------------------------------------------------------------

interface CompanyStoreState {
  company: Company | null
  agentBudgets: Record<string, AgentBudgetState>
  agentHealth: Record<string, AgentHealthState>
}

export const useCompanyStore = create<CompanyStoreState>()(() => ({
  company: null,
  agentBudgets: {},
  agentHealth: {},
}))
