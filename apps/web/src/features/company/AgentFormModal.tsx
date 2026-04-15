// @plan B0-PR-3
import { useState, useEffect, useCallback, useRef } from 'react'
import { serializeResource } from '@agentflow/core'
import type { InlineAgent, Company, ModelConfig } from '@agentflow/core'
import { ModelSelector } from '@agentflow/ui'
import { useCompanyStore } from '../../store/companyStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_SUGGESTIONS = [
  'CEO', 'CTO', 'Lead Engineer', 'Developer', 'Designer',
  'Analyst', 'PM', 'QA Engineer', 'DevOps', 'Data Scientist',
]

const CAPABILITY_OPTIONS = [
  'coding', 'research', 'writing', 'analysis',
  'review', 'planning', 'execution', 'management',
]

const DEFAULT_MODEL: ModelConfig = { provider: 'anthropic', model_id: 'claude-sonnet-4-6' }

const ON_TIMEOUT_OPTIONS = ['continue', 'fail', 'retry'] as const
type OnTimeout = typeof ON_TIMEOUT_OPTIONS[number]

// ---------------------------------------------------------------------------
// Form state shape
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  role: string
  persona: string
  model: ModelConfig
  capabilities: string[]
  monthly_budget: string
  reports_to: string
  department: string
  heartbeat_interval: string
  heartbeat_timeout: string
  on_timeout: OnTimeout
  memory_enabled: boolean
}

function agentToForm(agent: Partial<InlineAgent>): FormState {
  return {
    name: agent.name ?? '',
    role: agent.role ?? '',
    persona: agent.persona ?? '',
    model: agent.model ?? DEFAULT_MODEL,
    capabilities: (agent.capabilities as string[]) ?? [],
    monthly_budget: String(agent.budget?.monthly_usd ?? ''),
    reports_to: agent.reports_to ?? '',
    department: '',
    heartbeat_interval: String(agent.lifecycle?.heartbeat?.interval_seconds ?? 30),
    heartbeat_timeout: String(agent.lifecycle?.heartbeat?.timeout_seconds ?? 120),
    on_timeout: (agent.lifecycle?.heartbeat?.on_timeout as OnTimeout) ?? 'continue',
    memory_enabled: agent.memory?.enabled ?? false,
  }
}

function formToAgent(form: FormState): InlineAgent {
  const budget = form.monthly_budget
    ? { monthly_usd: parseFloat(form.monthly_budget), alert_threshold_pct: 80 }
    : undefined
  const lifecycle = {
    heartbeat: {
      interval_seconds: parseInt(form.heartbeat_interval) || 30,
      timeout_seconds: parseInt(form.heartbeat_timeout) || 120,
      on_timeout: form.on_timeout,
    },
  }
  return {
    name: form.name.trim(),
    role: form.role.trim(),
    persona: form.persona.trim() || undefined,
    model: form.model,
    capabilities: form.capabilities.length > 0 ? form.capabilities : undefined,
    budget,
    lifecycle,
    memory: { enabled: form.memory_enabled },
    reports_to: form.reports_to || null,
  }
}

function buildPreviewYaml(form: FormState, company: Company | null): string {
  if (!company) return ''
  try {
    const agent = formToAgent(form)
    // Build a minimal company with just this agent for preview
    const previewCompany: Company = {
      ...company,
      spec: { ...company.spec, agents: [agent] },
    }
    const full = serializeResource(previewCompany)
    // Extract just the first agent block
    const lines = full.split('\n')
    const agentIdx = lines.findIndex(l => l.includes('agents:'))
    if (agentIdx < 0) return full
    return lines.slice(agentIdx + 1).join('\n').trim()
  } catch {
    return '# preview error'
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentFormModalProps {
  agent?: InlineAgent
  open: boolean
  onClose: () => void
  mode: 'add' | 'edit'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentFormModal({ agent, open, onClose, mode }: AgentFormModalProps) {
  const company = useCompanyStore((s) => s.company)
  const addAgent = useCompanyStore((s) => s.addAgent)
  const updateAgent = useCompanyStore((s) => s.updateAgent)

  const [form, setForm] = useState<FormState>(() => agentToForm(agent ?? {}))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [yamlPreview, setYamlPreview] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(agentToForm(agent ?? {}))
      setErrors({})
    }
  }, [open, agent])

  // Debounced YAML preview update
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setYamlPreview(buildPreviewYaml(form, company))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [form, company])

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }, [])

  function toggleCapability(cap: string) {
    setForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter((c) => c !== cap)
        : [...prev.capabilities, cap],
    }))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) {
      errs.name = 'Name is required'
    } else if (!/^[a-z0-9-]+$/.test(form.name.trim())) {
      errs.name = 'Name must be lowercase letters, numbers, and hyphens only'
    } else if (mode === 'add' && company?.spec.agents.some((a) => a.name === form.name.trim())) {
      errs.name = 'Agent name already exists'
    }
    if (!form.role.trim()) {
      errs.role = 'Role is required'
    }
    if (form.monthly_budget && (isNaN(parseFloat(form.monthly_budget)) || parseFloat(form.monthly_budget) <= 0)) {
      errs.monthly_budget = 'Budget must be a positive number'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const agentSpec = formToAgent(form)
    if (mode === 'add') {
      addAgent(agentSpec)
    } else if (agent) {
      updateAgent(agent.name, agentSpec)
    }
    onClose()
  }

  if (!open) return null

  const otherAgents = company?.spec.agents.filter((a) => a.name !== agent?.name) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              {mode === 'add' ? 'Add Agent' : 'Edit Agent'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Name */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. alice"
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                disabled={mode === 'edit'}
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Role */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Role *</label>
              <input
                type="text"
                list="role-suggestions"
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                placeholder="e.g. Lead Engineer"
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="role-suggestions">
                {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
              {errors.role && <p className="mt-1 text-xs text-red-400">{errors.role}</p>}
            </div>

            {/* Persona */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Persona</label>
              <textarea
                value={form.persona}
                onChange={(e) => setField('persona', e.target.value)}
                rows={3}
                placeholder="Senior Python engineer. Direct and pragmatic."
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Model */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Model</label>
              <ModelSelector
                value={form.model}
                onChange={(cfg: ModelConfig) => setField('model', cfg)}
              />
            </div>

            {/* Capabilities */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.capabilities.includes(cap)
                        ? 'bg-indigo-600 text-white'
                        : 'border border-gray-600 bg-gray-800 text-gray-400 hover:border-indigo-500 hover:text-white'
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Budget */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Monthly Budget (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.monthly_budget}
                onChange={(e) => setField('monthly_budget', e.target.value)}
                placeholder="100"
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              {errors.monthly_budget && <p className="mt-1 text-xs text-red-400">{errors.monthly_budget}</p>}
            </div>

            {/* Reports To */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Reports To</label>
              <select
                value={form.reports_to}
                onChange={(e) => setField('reports_to', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">— None (top of hierarchy) —</option>
                {otherAgents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Heartbeat */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Heartbeat Interval (s)</label>
                <input
                  type="number"
                  min={5}
                  value={form.heartbeat_interval}
                  onChange={(e) => setField('heartbeat_interval', e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Heartbeat Timeout (s)</label>
                <input
                  type="number"
                  min={10}
                  value={form.heartbeat_timeout}
                  onChange={(e) => setField('heartbeat_timeout', e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* On Timeout */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">On Timeout</label>
              <div className="flex gap-4">
                {ON_TIMEOUT_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="on_timeout"
                      value={opt}
                      checked={form.on_timeout === opt}
                      onChange={() => setField('on_timeout', opt)}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-gray-300">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Memory */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.memory_enabled}
                onClick={() => setField('memory_enabled', !form.memory_enabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  form.memory_enabled ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.memory_enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <label className="text-sm text-gray-300">Memory Enabled</label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {mode === 'add' ? 'Add Agent' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Right: YAML Preview */}
        <div className="hidden w-80 flex-col border-l border-gray-700 lg:flex">
          <div className="border-b border-gray-700 px-4 py-3">
            <span className="text-xs font-medium text-gray-400">YAML Preview</span>
          </div>
          <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap">
            {yamlPreview || '# fill in fields above'}
          </pre>
        </div>
      </div>
    </div>
  )
}
