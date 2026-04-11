// @plan B2-PR-4
import type { AgentPodNode, AgentSpec } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'
import { AgentSelector } from './widgets/AgentSelector'
import type { AgentReference } from '@agentflow/core'

interface AgentPodFormProps {
  value: Partial<AgentPodNode>
  onChange: (val: Partial<AgentPodNode>) => void
  availableAgents: (AgentSpec & { name: string })[]
  availableVariables: AvailableVariable[]
  /** Resolved agentSpec for the currently selected agent */
  resolvedAgentSpec?: AgentSpec
}

export function AgentPodForm({
  value,
  onChange,
  availableAgents,
  availableVariables,
  resolvedAgentSpec,
}: AgentPodFormProps) {
  const inputs = value.inputs ?? {}

  function setAgentRef(ref: AgentReference | null) {
    onChange({ ...value, agent_ref: ref ?? undefined })
  }

  function setInstruction(instruction: string) {
    onChange({ ...value, instruction })
  }

  function setInputKey(oldKey: string, newKey: string) {
    const next = { ...inputs }
    const val = next[oldKey]
    delete next[oldKey]
    if (newKey) next[newKey] = val!
    onChange({ ...value, inputs: next })
  }

  function setInputValue(key: string, ref: Parameters<typeof VariableReferencePicker>[0]['value']) {
    if (!ref || typeof ref === 'string') return
    onChange({ ...value, inputs: { ...inputs, [key]: ref } })
  }

  function addInput() {
    const newKey = `input_${Object.keys(inputs).length + 1}`
    onChange({ ...value, inputs: { ...inputs, [newKey]: { node_id: '', variable: '', path: [] } } })
  }

  function removeInput(key: string) {
    const next = { ...inputs }
    delete next[key]
    onChange({ ...value, inputs: next })
  }

  return (
    <div className="space-y-5">
      {/* Agent selector — primary field */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Agent</label>
        <AgentSelector
          value={value.agent_ref ?? null}
          onChange={setAgentRef}
          availableAgents={availableAgents}
        />
      </div>

      {/* Read-only agent details panel */}
      {resolvedAgentSpec && (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-gray-300">Agent details</span>
            <span className="text-gray-500">from Company</span>
          </div>
          <div className="space-y-1 text-gray-400">
            <div>
              <span className="text-gray-500">Role: </span>
              <span className="rounded bg-indigo-900 px-1 text-indigo-300">{resolvedAgentSpec.role}</span>
            </div>
            {resolvedAgentSpec.persona && (
              <div>
                <span className="text-gray-500">Persona: </span>
                <span className="text-gray-300 italic">
                  "{resolvedAgentSpec.persona.slice(0, 80)}{resolvedAgentSpec.persona.length > 80 ? '…' : ''}"
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Model: </span>
              <span className="font-mono text-gray-300">{resolvedAgentSpec.model.model_id}</span>
            </div>
            {resolvedAgentSpec.budget && (
              <div>
                <span className="text-gray-500">Budget: </span>
                <span className="text-gray-300">${resolvedAgentSpec.budget.monthly_usd}/mo</span>
              </div>
            )}
          </div>
          <a
            href="#company-editor"
            className="mt-2 block text-blue-500 hover:text-blue-400"
          >
            Edit agent in Company Editor →
          </a>
        </div>
      )}

      {/* Instruction */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Instruction</label>
        <textarea
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          placeholder="Instructions for this agent…"
          value={value.instruction ?? ''}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </div>

      {/* Inputs table */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Inputs</label>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-blue-400"
            onClick={addInput}
          >
            + Add input
          </button>
        </div>
        <div className="space-y-2">
          {Object.entries(inputs).map(([key, ref]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                className="w-28 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none"
                value={key}
                onChange={(e) => setInputKey(key, e.target.value)}
              />
              <div className="flex-1">
                <VariableReferencePicker
                  value={ref}
                  onChange={(v) => setInputValue(key, v)}
                  availableVariables={availableVariables}
                />
              </div>
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-red-400"
                onClick={() => removeInput(key)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
