// @plan B2-PR-4
import type { StartNode, VariableDefinition, VariableType } from '@agentflow/core'

interface StartNodeFormProps {
  value: Partial<StartNode>
  onChange: (val: Partial<StartNode>) => void
}

const VAR_TYPES: VariableType[] = ['string', 'number', 'boolean', 'object', 'array', 'file']

function emptyVar(): VariableDefinition {
  return { key: '', type: 'string' }
}

export function StartNodeForm({ value, onChange }: StartNodeFormProps) {
  const outputs: VariableDefinition[] = value.outputs ?? []

  function addVar() {
    onChange({ ...value, outputs: [...outputs, emptyVar()] })
  }

  function updateVar(idx: number, patch: Partial<VariableDefinition>) {
    onChange({ ...value, outputs: outputs.map((v, i) => (i === idx ? { ...v, ...patch } : v)) })
  }

  function removeVar(idx: number) {
    onChange({ ...value, outputs: outputs.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-300">Output variables</label>
        <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addVar}>
          + Add variable
        </button>
      </div>

      <div className="space-y-2">
        {outputs.map((v, idx) => (
          <div key={idx} className="rounded border border-gray-700 p-2">
            <div className="mb-2 flex items-center gap-2">
              <input
                className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 font-mono text-sm text-gray-200 focus:outline-none"
                placeholder="variable_name"
                value={v.key}
                onChange={(e) => updateVar(idx, { key: e.target.value })}
              />
              <select
                className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none"
                value={v.type}
                onChange={(e) => updateVar(idx, { type: e.target.value as VariableType })}
              >
                {VAR_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={v.required ?? false}
                  onChange={(e) => updateVar(idx, { required: e.target.checked })}
                />
                Req
              </label>
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-red-400"
                onClick={() => removeVar(idx)}
              >
                ✕
              </button>
            </div>
            <input
              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-500 placeholder-gray-700 focus:outline-none"
              placeholder="Description (optional)"
              value={v.description ?? ''}
              onChange={(e) => updateVar(idx, { description: e.target.value })}
            />
          </div>
        ))}
        {outputs.length === 0 && (
          <div className="text-xs text-gray-600">
            Define the input variables this pipeline expects when triggered.
          </div>
        )}
      </div>
    </div>
  )
}
