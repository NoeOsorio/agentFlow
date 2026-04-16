// @plan B3-PR-4
import { create } from 'zustand'
import { parseResource, serializeResource, validateResource } from '@agentflow/core'
import type { Company, InlineAgent } from '@agentflow/core'
import type { AgentBudgetState, AgentHealthState } from './types'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface CompanyStore {
  // Company metadata
  companyId: string | null
  companyName: string
  namespace: string
  company: Company | null
  saveStatus: SaveStatus

  // YAML state
  yamlSpec: string
  yamlValid: boolean
  yamlErrors: string[]

  // Live agent state (populated from API / WebSocket)
  agentBudgets: Record<string, AgentBudgetState>
  agentHealth: Record<string, AgentHealthState>

  // Actions
  /** `companyName` is the resource name in `/api/companies/{name}` (not UUID). */
  loadCompany(companyName: string): Promise<void>
  saveCompany(): Promise<void>
  setYamlSpec(yaml: string): void
  addAgent(agent: InlineAgent): void
  updateAgent(agentName: string, patch: Partial<InlineAgent>): void
  deleteAgent(agentName: string): void
  setAgentBudget(agentName: string, budget: AgentBudgetState): void
  setAgentHealth(agentName: string, health: AgentHealthState): void
  refreshBudgets(): Promise<void>
}

// ---------------------------------------------------------------------------
// Debounced auto-save (500 ms)
// ---------------------------------------------------------------------------

let _saveTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// WebSocket heartbeat (module-level so it survives re-renders)
// ---------------------------------------------------------------------------

let _heartbeatWs: WebSocket | null = null

let _heartbeatRetries = 0
const MAX_HEARTBEAT_RETRIES = 3
const HEARTBEAT_RETRY_DELAY_MS = 2000

function _connectHeartbeat(
  companyId: string,
  onMessage: (health: import('./types').AgentHealthState) => void,
): void {
  if (_heartbeatWs) {
    _heartbeatWs.close()
    _heartbeatWs = null
  }
  _heartbeatRetries = 0

  function connect() {
    const wsUrl = `ws://${window.location.host}/api/ws/companies/${encodeURIComponent(companyId)}/agents`
    const ws = new WebSocket(wsUrl)
    _heartbeatWs = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as import('./types').AgentHealthState
        onMessage(data)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (_heartbeatWs !== ws) return // replaced by a newer connection
      _heartbeatRetries += 1
      if (_heartbeatRetries <= MAX_HEARTBEAT_RETRIES) {
        setTimeout(connect, HEARTBEAT_RETRY_DELAY_MS)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  connect()
}

function scheduleSave(saveFn: () => Promise<void>): void {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    saveFn()
  }, 500)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCompanyStore = create<CompanyStore>()((set, get) => ({
  companyId: null,
  companyName: '',
  namespace: 'default',
  company: null,
  saveStatus: 'idle',
  yamlSpec: '',
  yamlValid: false,
  yamlErrors: [],
  agentBudgets: {},
  agentHealth: {},

  async loadCompany(companyName) {
    const res = await fetch(`/api/companies/${encodeURIComponent(companyName)}`)
    if (!res.ok) throw new Error(`Failed to load company: ${res.status}`)
    const data = (await res.json()) as { yaml_spec: string; id: string }
    get().setYamlSpec(data.yaml_spec)
    set({ companyId: data.id })
    _connectHeartbeat(data.id, (health) => {
      get().setAgentHealth(health.agentName, health)
    })
  },

  async saveCompany() {
    const { yamlSpec } = get()
    if (!yamlSpec.trim()) return
    set({ saveStatus: 'saving' })
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_content: yamlSpec }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  },

  setYamlSpec(yaml) {
    const result = validateResource(yaml)
    if (!result.success) {
      const messages =
        'errors' in result.error
          ? result.error.errors.map((e: { message: string }) => e.message)
          : [result.error.message]
      // Preserve existing company — invalid YAML doesn't wipe valid state
      set({ yamlSpec: yaml, yamlValid: false, yamlErrors: messages })
      return
    }
    const company = parseResource(yaml) as Company
    set({
      yamlSpec: yaml,
      yamlValid: true,
      yamlErrors: [],
      company,
      companyName: company.metadata.name,
      namespace: company.metadata.namespace ?? 'default',
    })
  },

  addAgent(agent) {
    const { company } = get()
    if (!company) return
    const updated: Company = {
      ...company,
      spec: { ...company.spec, agents: [...company.spec.agents, agent] },
    }
    const yaml = serializeResource(updated)
    set({ company: updated, yamlSpec: yaml })
    scheduleSave(get().saveCompany)
  },

  updateAgent(agentName, patch) {
    const { company } = get()
    if (!company) return
    const updated: Company = {
      ...company,
      spec: {
        ...company.spec,
        agents: company.spec.agents.map((a) =>
          a.name === agentName ? { ...a, ...patch } : a,
        ),
      },
    }
    const yaml = serializeResource(updated)
    set({ company: updated, yamlSpec: yaml })
    scheduleSave(get().saveCompany)
  },

  deleteAgent(agentName) {
    const { company } = get()
    if (!company) return
    // TODO(B3-PR-2): warn if agentName is referenced in pipelineStore agent_pod nodes
    const updated: Company = {
      ...company,
      spec: {
        ...company.spec,
        agents: company.spec.agents.filter((a) => a.name !== agentName),
      },
    }
    const yaml = serializeResource(updated)
    set({ company: updated, yamlSpec: yaml })
    scheduleSave(get().saveCompany)
  },

  setAgentBudget(agentName, budget) {
    set((state) => ({ agentBudgets: { ...state.agentBudgets, [agentName]: budget } }))
  },

  setAgentHealth(agentName, health) {
    set((state) => ({ agentHealth: { ...state.agentHealth, [agentName]: health } }))
  },

  async refreshBudgets() {
    const { companyId, companyName } = get()
    const identifier = companyId ?? companyName
    if (!identifier) return
    const res = await fetch(`/api/companies/${encodeURIComponent(identifier)}/budget`)
    if (!res.ok) return
    const data = (await res.json()) as {
      company_name: string
      agents: { agent_name: string; month: string; spent_usd: number; token_count: number }[]
    }
    for (const agent of data.agents) {
      get().setAgentBudget(agent.agent_name, {
        agentName: agent.agent_name,
        spentUsd: agent.spent_usd,
        budgetUsd: 0,
        remainingUsd: 0,
        pctUsed: 0,
        month: agent.month,
      })
    }
  },
}))
