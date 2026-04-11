// @plan B2-PR-4
import type { SubWorkflowNode } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'

interface SubWorkflowFormProps {
  value: Partial<SubWorkflowNode>
  onChange: (val: Partial<SubWorkflowNode>) => void
  availableVariables: AvailableVariable[]
  /** List of pipeline names available to reference */
  availablePipelines?: string[]
}

export function SubWorkflowForm({
  value,
  onChange,
  availableVariables,
  availablePipelines = [],
}: SubWorkflowFormProps) {
  const inputs = value.inputs ?? {}
  const pipelineRef = value.pipeline_ref ?? { name: '', namespace: undefined }

  function addInput() {
    const key = `input_${Object.keys(inputs).length + 1}`
    onChange({ ...value, inputs: { ...inputs, [key]: { node_id: '', variable: '', path: [] } } })
  }

  function setInputValue(key: string, ref: Parameters<typeof VariableReferencePicker>[0]['value']) {
    if (!ref || typeof ref === 'string') return
    onChange({ ...value, inputs: { ...inputs, [key]: ref } })
  }

  function setInputKey(oldKey: string, newKey: string) {
    const next: typeof inputs = {}
    for (const [k, v] of Object.entries(inputs)) {
      next[k === oldKey ? newKey : k] = v
    }
    onChange({ ...value, inputs: next })
  }

  function removeInput(key: string) {
    const next = { ...inputs }
    delete next[key]
    onChange({ ...value, inputs: next })
  }

  return (
    <div className="space-y-4">
      {/* Pipeline selector */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Pipeline</label>
        {availablePipelines.length > 0 ? (
          <select
            className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={pipelineRef.name}
            onChange={(e) =>
              onChange({ ...value, pipeline_ref: { ...pipelineRef, name: e.target.value } })
            }
          >
            <option value="">Select pipeline…</option>
            {availablePipelines.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <input
            className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="pipeline-name"
            value={pipelineRef.name}
            onChange={(e) =>
              onChange({ ...value, pipeline_ref: { ...pipelineRef, name: e.target.value } })
            }
          />
        )}
      </div>

      {/* Namespace */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Namespace (optional)</label>
        <input
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="default"
          value={pipelineRef.namespace ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              pipeline_ref: { ...pipelineRef, namespace: e.target.value || undefined },
            })
          }
        />
      </div>

      {/* Inputs */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Inputs</label>
          <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addInput}>
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
